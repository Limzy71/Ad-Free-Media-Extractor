<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

class MediaProxyController extends Controller
{
    private const ALLOWED_SCHEMES = ['http', 'https'];

    private const MAX_FILE_SIZE = 500 * 1024 * 1024;

    public function __invoke(Request $request): Response|JsonResponse
    {
        $request->validate([
            'media_url' => 'required|url|max:4096',
            'referer' => 'nullable|string|max:2048',
        ]);

        $mediaUrl = $request->input('media_url');
        $urlObj = parse_url($mediaUrl);
        $host = $urlObj['host'] ?? '';

        if (!in_array($urlObj['scheme'] ?? '', self::ALLOWED_SCHEMES, true)) {
            return response('URL scheme not allowed', 400);
        }

        // Jika target adalah manifest HLS (.m3u8), lakukan rewriting manifest agar
        // seluruh segmen/varians juga lewat proxy backend (bypass anti-hotlink & blokir ISP).
        if ($this->isHlsManifest($mediaUrl)) {
            return $this->proxyHlsManifest($request, $mediaUrl, $host);
        }

        return $this->streamDirect($request, $mediaUrl, $host);
    }

    /**
     * Mendeteksi apakah URL mengarah ke manifest HLS
     */
    private function isHlsManifest(string $url): bool
    {
        $path = strtolower(parse_url($url, PHP_URL_PATH) ?? '');
        return str_ends_with($path, '.m3u8');
    }

    /**
     * Menghitung base URL backend agar dapat menghasilkan URL proxy absolut yang valid
     */
    private function backendBaseUrl(Request $request): string
    {
        $scheme = $request->server('HTTPS') ? 'https' : 'http';
        $host = $request->getHost();
        $port = $request->getPort();

        if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
            return "{$scheme}://{$host}";
        }

        return "{$scheme}://{$host}:{$port}";
    }

    /**
     * Bypass resolusi DNS ISP via DoH dan melakukan HTTP request terkontrol ke host asal
     */
    private function resolveHostIp(string $host): ?string
    {
        $resolvedIp = gethostbyname($host);

        if ($resolvedIp === $host || !$this->isPublicInternetIp($resolvedIp)) {
            $resolvedIp = $this->resolveViaDoH($host);
        }

        if ($resolvedIp === null || !$this->isPublicInternetIp($resolvedIp)) {
            return null;
        }

        return $resolvedIp;
    }

    /**
     * Membangun array header yang meniru browser asli untuk melewati anti-hotlink ringan
     */
    private function buildBrowserHeaders(Request $request, string $host, array $extra = []): array
    {
        $referer = $request->input('referer', "https://{$host}/");

        $headers = [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept' => '*/*',
            'Accept-Language' => 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer' => $referer,
            'Origin' => "https://{$host}",
        ];

        foreach ($extra as $key => $value) {
            $headers[$key] = $value;
        }

        return $headers;
    }

    /**
     * Proxy manifest HLS (.m3u8): ambil playlist, tulis-ulang seluruh URL varian/segmen
     * agar dilewatkan kembali melalui proxy backend (dengan Referer/Origin asli).
     */
    private function proxyHlsManifest(Request $request, string $mediaUrl, string $host): Response|JsonResponse
    {
        $resolvedIp = $this->resolveHostIp($host);
        if ($resolvedIp === null) {
            return response('DNS resolution failed - domain may be blocked or invalid', 403);
        }

        $port = isset(parse_url($mediaUrl)['port'])
            ? (int) parse_url($mediaUrl)['port']
            : (str_starts_with($mediaUrl, 'https:') ? 443 : 80);

        $baseUrl = $this->backendBaseUrl($request);
        $referer = $request->input('referer', "https://{$host}/");

        try {
            $response = Http::withHeaders($this->buildBrowserHeaders($request, $host))
                ->timeout(20)
                ->withOptions([
                    'curl' => [
                        CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
                    ],
                ])
                ->get($mediaUrl, $request->query());

            if (!$response->successful()) {
                return response('Upstream HLS error', $response->status());
            }

            $manifest = $response->body();

            // URL dasar untuk menyelesaikan URI relatif di dalam manifest
            $base = $this->resolveBaseUrl($mediaUrl);
            $proxyEndpoint = "{$baseUrl}/api/v1/proxy-media";

            $rewritten = $this->rewriteHlsManifest(
                $manifest,
                $base,
                $proxyEndpoint,
                $referer
            );

            return response($rewritten, 200, [
                'Content-Type' => 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Headers' => 'Content-Type, Referer',
                'Cache-Control' => 'no-cache',
            ]);
        } catch (\Exception) {
            return response('Proxy HLS request failed', 502);
        }
    }

    /**
     * Resolve URI relatif terhadap URL manifest
     */
    private function resolveBaseUrl(string $mediaUrl): string
    {
        $parts = parse_url($mediaUrl);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ":{$parts['port']}" : '';

        $path = str_replace(basename($parts['path'] ?? '/'), '', $parts['path'] ?? '/');

        return "{$scheme}://{$host}{$port}{$path}";
    }

    /**
     * Tulis-ulang manifest HLS: ganti URI segmen (.ts/.m4s/.aac/.m4a) dan playlist varian
     * agar seluruh unduhan lewat proxy backend.
     */
    private function rewriteHlsManifest(
        string $manifest,
        string $base,
        string $proxyEndpoint,
        string $referer
    ): string {
        $lines = explode("\n", $manifest);
        $output = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Jabarkan URL absolut apapun ke melalui proxy
            if ($this->isMediaUri($trimmed)) {
                $absolute = $this->toAbsoluteUrl($trimmed, $base);
                $output[] = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
                continue;
            }

            // Tangani tag yang menyisipkan URI (mis. #EXT-X-MAP, #EXT-X-KEY, #EXT-X-MEDIA URI)
            if (str_starts_with($trimmed, '#')) {
                $output[] = $this->rewriteTagUri($trimmed, $base, $proxyEndpoint, $referer);
                continue;
            }

            $output[] = $line;
        }

        return implode("\n", $output);
    }

    /**
     * Cek apakah baris merupakan URI media (bukan tag komentar)
     */
    private function isMediaUri(string $line): bool
    {
        if ($line === '' || str_starts_with($line, '#')) {
            return false;
        }

        return true;
    }

    /**
     * Tulis-ulang URI di dalam tag komentar HLS (seperti EXT-X-MAP, EXT-X-KEY URI=, EXT-X-MEDIA URI=)
     */
    private function rewriteTagUri(string $line, string $base, string $proxyEndpoint, string $referer): string
    {
        // Ganti URI="..." di dalam tag
        if (preg_match('/URI="([^"]*)"/i', $line, $matches)) {
            $absolute = $this->toAbsoluteUrl($matches[1], $base);
            $proxy = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
            return preg_replace('/URI="[^"]*"/i', 'URI="' . $proxy . '"', $line);
        }

        // Ganti URI='...' di dalam tag
        if (preg_match("/URI='([^']*)'/i", $line, $matches)) {
            $absolute = $this->toAbsoluteUrl($matches[1], $base);
            $proxy = $this->toProxyUrl($proxyEndpoint, $absolute, $referer);
            return preg_replace("/URI='[^']*'/i", "URI='" . $proxy . "'", $line);
        }

        return $line;
    }

    /**
     * Mengubah URI (relatif/absolut) menjadi URL absolut terhadap base
     */
    private function toAbsoluteUrl(string $uri, string $base): string
    {
        if (preg_match('#^https?://#i', $uri)) {
            return $uri;
        }
        return rtrim($base, '/') . '/' . ltrim($uri, '/');
    }

    /**
     * Membangun URL proxy untuk stream/segmen tertentu
     */
    private function toProxyUrl(string $proxyEndpoint, string $absoluteUrl, string $referer): string
    {
        $params = http_build_query([
            'media_url' => $absoluteUrl,
            'referer' => $referer,
        ]);
        return $proxyEndpoint . '?' . $params;
    }

    /**
     * Proxy stream langsung (MP4/WebM/segmen .ts/.m4s) dengan dukungan Range & bypass DoH
     */
    private function streamDirect(Request $request, string $mediaUrl, string $host): Response
    {
        $resolvedIp = $this->resolveHostIp($host);
        if ($resolvedIp === null) {
            return response('DNS resolution failed - domain may be blocked or invalid', 403);
        }

        $urlObj = parse_url($mediaUrl);
        $port = isset($urlObj['port']) ? (int) $urlObj['port'] : (str_starts_with($mediaUrl, 'https:') ? 443 : 80);

        $extraHeaders = [];
        $range = $request->header('Range');
        if ($range) {
            $extraHeaders['Range'] = $range;
        }

        try {
            $response = Http::withHeaders(
                $this->buildBrowserHeaders($request, $host, $extraHeaders)
            )
                ->timeout(30)
                ->withOptions([
                    'stream' => true,
                    'curl' => [
                        CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
                    ],
                ])
                ->get($mediaUrl, $request->query());

            if (!$response->successful() && $response->status() !== 206) {
                return response('Upstream error', $response->status());
            }

            $contentType = $response->header('Content-Type', 'application/octet-stream');

            $streamedResponse = response()->stream(
                function () use ($response) {
                    $body = $response->toPsrResponse()->getBody();
                    $totalRead = 0;

                    while (!$body->eof()) {
                        $chunk = $body->read(8192);
                        $totalRead += strlen($chunk);

                        if ($totalRead > self::MAX_FILE_SIZE) {
                            break;
                        }

                        echo $chunk;
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    }
                },
                200,
                [
                    'Content-Type' => $contentType,
                    'Access-Control-Allow-Origin' => '*',
                    'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers' => 'Content-Type, Referer, Range',
                    'Access-Control-Expose-Headers' => 'Content-Length, Content-Type, Accept-Ranges, Content-Range',
                    'Cache-Control' => 'public, max-age=3600',
                ]
            );

            if ($response->status() === 206) {
                $contentRange = $response->header('Content-Range');
                if ($contentRange) {
                    $streamedResponse->header('Content-Range', $contentRange);
                }
                $streamedResponse->setStatusCode(206);
            }

            $contentLength = $response->header('Content-Length');
            if ($contentLength) {
                $streamedResponse->header('Content-Length', min($contentLength, self::MAX_FILE_SIZE));
            }

            return $streamedResponse;
        } catch (\Exception) {
            return response('Proxy request failed', 502);
        }
    }

    /**
     * Resolve domain via DNS-over-HTTPS (Cloudflare & Google) untuk bypass blokir DNS ISP
     */
    private function resolveViaDoH(string $host): ?string
    {
        // Coba Cloudflare DoH (1.1.1.1)
        try {
            $response = Http::timeout(5)
                ->withHeaders(['Accept' => 'application/dns-json'])
                ->get("https://cloudflare-dns.com/dns-query", [
                    'name' => $host,
                    'type' => 'A',
                ]);

            if ($response->successful()) {
                $data = $response->json();
                if (($data['Status'] ?? -1) === 0 && !empty($data['Answer'])) {
                    foreach ($data['Answer'] as $answer) {
                        if (($answer['type'] ?? 0) === 1 && !empty($answer['data'])) {
                            $ip = $answer['data'];
                            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                                return $ip;
                            }
                        }
                    }
                }
            }
        } catch (\Exception) {
            // Cloudflare DoH gagal, coba Google
        }

        // Coba Google DoH
        try {
            $response = Http::timeout(5)
                ->get("https://dns.google/resolve", [
                    'name' => $host,
                    'type' => 'A',
                ]);

            if ($response->successful()) {
                $data = $response->json();
                if (($data['Status'] ?? -1) === 0 && !empty($data['Answer'])) {
                    foreach ($data['Answer'] as $answer) {
                        if (($answer['type'] ?? 0) === 1 && !empty($answer['data'])) {
                            $ip = $answer['data'];
                            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                                return $ip;
                            }
                        }
                    }
                }
            }
        } catch (\Exception) {
            // Kedua DoH gagal
        }

        return null;
    }

    private function isPublicInternetIp(string $ip): bool
    {
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return true;
        }

        return false;
    }
}
