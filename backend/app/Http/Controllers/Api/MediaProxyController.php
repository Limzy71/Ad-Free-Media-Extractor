<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaProxyController extends Controller
{
    private const ALLOWED_SCHEMES = ['http', 'https'];

    public function __invoke(Request $request)
    {
        // Tangani preflight CORS OPTIONS
        if ($request->isMethod('OPTIONS')) {
            return response('', 204, [
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type, Referer, Range, Origin, User-Agent',
                'Access-Control-Max-Age' => '86400',
            ]);
        }

        $mediaUrl = $request->input('media_url') ?? $request->query('media_url');

        if (!$mediaUrl || !filter_var($mediaUrl, FILTER_VALIDATE_URL)) {
            return response('Invalid media_url parameter', 400);
        }

        $urlObj = parse_url($mediaUrl);
        $scheme = strtolower($urlObj['scheme'] ?? '');
        $host = strtolower($urlObj['host'] ?? '');

        if (!in_array($scheme, self::ALLOWED_SCHEMES, true) || empty($host)) {
            return response('URL scheme not allowed', 400);
        }

        $resolvedIp = $this->resolveHostIp($host);
        if ($resolvedIp === null) {
            return response('DNS resolution failed - domain may be invalid or unreachable', 403);
        }

        $port = isset($urlObj['port']) ? (int) $urlObj['port'] : ($scheme === 'https' ? 443 : 80);
        $referer = $request->input('referer') ?? $request->query('referer') ?? "{$scheme}://{$host}/";

        // Jika request adalah manifest HLS (.m3u8), lakukan rewrite manifest
        if ($this->isHlsManifest($mediaUrl)) {
            return $this->proxyHlsManifest($request, $mediaUrl, $host, $port, $resolvedIp, $referer);
        }

        // Stream video biner langsung (MP4, WebM, TS segment) dengan dukungan HTTP 206 Partial Content (Range)
        return $this->streamDirect($request, $mediaUrl, $host, $port, $resolvedIp, $referer);
    }

    /**
     * Memeriksa apakah URL merupakan manifest playlist HLS (.m3u8)
     */
    private function isHlsManifest(string $url): bool
    {
        $path = strtolower(parse_url($url, PHP_URL_PATH) ?? '');
        return str_ends_with($path, '.m3u8') || str_contains($path, '.m3u8');
    }

    /**
     * Proxy manifest HLS dan rewrite URL segmen agar tetap melalui proxy
     */
    private function proxyHlsManifest(Request $request, string $mediaUrl, string $host, int $port, string $resolvedIp, string $referer)
    {
        $ch = curl_init($mediaUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
            CURLOPT_HTTPHEADER => $this->buildCurlHeaders($request, $host, $referer),
        ]);

        $content = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/vnd.apple.mpegurl';
        curl_close($ch);

        if ($httpCode >= 400 || !$content) {
            return response('Upstream HLS manifest error', $httpCode ?: 502);
        }

        $baseUrl = dirname($mediaUrl);
        $proxyEndpoint = url('/api/v1/proxy-media');
        $rewrittenManifest = $this->rewriteM3u8($content, $baseUrl, $proxyEndpoint, $referer);

        return response($rewrittenManifest, 200, [
            'Content-Type' => $contentType,
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Referer, Range',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * Tulis-ulang manifest .m3u8
     */
    private function rewriteM3u8(string $manifest, string $base, string $proxyEndpoint, string $referer): string
    {
        $lines = explode("\n", $manifest);
        $output = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if ($this->isMediaUri($trimmed)) {
                $absolute = $this->toAbsoluteUrl($trimmed, $base);
                $output[] = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
                continue;
            }

            if (str_starts_with($trimmed, '#')) {
                $output[] = $this->rewriteTagUri($trimmed, $base, $proxyEndpoint, $referer);
                continue;
            }

            $output[] = $line;
        }

        return implode("\n", $output);
    }

    private function isMediaUri(string $line): bool
    {
        return $line !== '' && !str_starts_with($line, '#');
    }

    private function rewriteTagUri(string $line, string $base, string $proxyEndpoint, string $referer): string
    {
        if (preg_match('/URI="([^"]*)"/i', $line, $matches)) {
            $absolute = $this->toAbsoluteUrl($matches[1], $base);
            $proxy = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
            return preg_replace('/URI="[^"]*"/i', 'URI="' . $proxy . '"', $line);
        }

        if (preg_match("/URI='([^']*)'/i", $line, $matches)) {
            $absolute = $this->toAbsoluteUrl($matches[1], $base);
            $proxy = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
            return preg_replace("/URI='[^']*'/i", "URI='" . $proxy . "'", $line);
        }

        return $line;
    }

    private function toAbsoluteUrl(string $uri, string $base): string
    {
        if (preg_match('#^https?://#i', $uri)) {
            return $uri;
        }
        return rtrim($base, '/') . '/' . ltrim($uri, '/');
    }

    private function toProxyUrl(string $proxyEndpoint, string $absoluteUrl, string $referer): string
    {
        return $proxyEndpoint . '?' . http_build_query([
            'media_url' => $absoluteUrl,
            'referer' => $referer,
        ]);
    }

    /**
     * Stream binary langsung (MP4, WebM, TS) dengan cURL streaming
     */
    private function streamDirect(Request $request, string $mediaUrl, string $host, int $port, string $resolvedIp, string $referer)
    {
        $headers = $this->buildCurlHeaders($request, $host, $referer);

        $range = $request->header('Range');
        if ($range) {
            $headers[] = 'Range: ' . $range;
        }

        return new StreamedResponse(function () use ($mediaUrl, $host, $port, $resolvedIp, $headers) {
            $ch = curl_init($mediaUrl);
            curl_setopt_array($ch, [
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_TIMEOUT => 0,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_HEADERFUNCTION => function ($curl, $header) {
                    $len = strlen($header);
                    $parts = explode(':', $header, 2);
                    if (count($parts) === 2) {
                        $name = strtolower(trim($parts[0]));
                        $val = trim($parts[1]);
                        if (in_array($name, ['content-type', 'content-length', 'content-range', 'accept-ranges'])) {
                            header("{$name}: {$val}");
                        }
                    }
                    return $len;
                },
                CURLOPT_WRITEFUNCTION => function ($curl, $data) {
                    echo $data;
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                    return strlen($data);
                },
            ]);

            curl_exec($ch);
            curl_close($ch);
        }, 200, [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Referer, Range, Origin, User-Agent',
            'Access-Control-Expose-Headers' => 'Content-Length, Content-Type, Accept-Ranges, Content-Range',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    private function buildCurlHeaders(Request $request, string $host, string $referer): array
    {
        return [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer: ' . $referer,
            'Origin: https://' . $host,
            'Accept: */*',
            'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        ];
    }

    private function resolveHostIp(string $host): ?string
    {
        $resolvedIp = gethostbyname($host);
        if ($resolvedIp !== $host && $this->isPublicInternetIp($resolvedIp)) {
            return $resolvedIp;
        }

        return $this->resolveViaDoH($host);
    }

    private function resolveViaDoH(string $host): ?string
    {
        // 1. Cloudflare DoH (1.1.1.1)
        $ch = curl_init("https://cloudflare-dns.com/dns-query?name=" . urlencode($host) . "&type=A");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER => ['Accept: application/dns-json'],
        ]);
        $res = curl_exec($ch);
        curl_close($ch);

        if ($res) {
            $data = json_decode($res, true);
            if (($data['Status'] ?? -1) === 0 && !empty($data['Answer'])) {
                foreach ($data['Answer'] as $ans) {
                    if (($ans['type'] ?? 0) === 1 && !empty($ans['data']) && $this->isPublicInternetIp($ans['data'])) {
                        return $ans['data'];
                    }
                }
            }
        }

        // 2. Google DoH (8.8.8.8)
        $ch = curl_init("https://dns.google/resolve?name=" . urlencode($host) . "&type=A");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);

        if ($res) {
            $data = json_decode($res, true);
            if (($data['Status'] ?? -1) === 0 && !empty($data['Answer'])) {
                foreach ($data['Answer'] as $ans) {
                    if (($ans['type'] ?? 0) === 1 && !empty($ans['data']) && $this->isPublicInternetIp($ans['data'])) {
                        return $ans['data'];
                    }
                }
            }
        }

        return null;
    }

    private function isPublicInternetIp(string $ip): bool
    {
        return (bool) filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}