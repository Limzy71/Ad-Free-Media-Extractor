<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaProxyController extends Controller
{
    private const ALLOWED_SCHEMES = ['http', 'https'];

    private const CONTENT_TYPE_CACHE_TTL = 60;

    /** @var array<string, array{ts: int, type: string}> */
    private static array $contentTypeCache = [];

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
        $variants = [
            $this->buildCurlHeaders($request, $host, $referer),
            $this->buildCleanHeaders(),
        ];

        $content = '';
        $httpCode = 0;
        $contentType = 'application/vnd.apple.mpegurl';

        foreach ($variants as $variant) {
            $ch = curl_init($mediaUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
                CURLOPT_HTTPHEADER => $variant,
            ]);

            $content = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/vnd.apple.mpegurl';
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 300 && $content !== '') {
                break;
            }
        }

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
     * Stream binary langsung (MP4, WebM, TS) dengan cURL streaming.
     *
     * Header response (Content-Type, Content-Length, Content-Range, status 206)
     * diambil via probe ke upstream TERLEBIH DAHULU, karena header HTTP
     * response tidak bisa diubah lagi setelah StreamedResponse mulai dikirim.
     */
    private function streamDirect(Request $request, string $mediaUrl, string $host, int $port, string $resolvedIp, string $referer)
    {
        $refererHeaders = $this->buildCurlHeaders($request, $host, $referer);
        $cleanHeaders = $this->buildCleanHeaders();

        $range = $request->header('Range');

        $meta = $this->probeUpstream($mediaUrl, $host, $port, $resolvedIp, $refererHeaders, $cleanHeaders, $range ?: 'bytes=0-0');

        if ($meta['status'] >= 400 || $meta['status'] === 0) {
            return response('Upstream media error', $meta['status'] ?: 502, [
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            ]);
        }

        if (!$this->isValidProbe($meta)) {
            return response('Upstream is not a playable media stream', 415, [
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            ]);
        }

        // 206 hanya jika client mengirim Range DAN upstream benar-benar menjawab 206.
        $statusCode = ($meta['status'] === 206 && $range) ? 206 : 200;

        $responseHeaders = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Referer, Range, Origin, User-Agent',
            'Access-Control-Expose-Headers' => 'Content-Length, Content-Type, Accept-Ranges, Content-Range',
            'Cache-Control' => 'public, max-age=3600',
        ];

        if ($meta['contentType'] !== '') {
            $responseHeaders['Content-Type'] = $meta['contentType'];
        }

        if ($meta['status'] === 206) {
            $responseHeaders['Accept-Ranges'] = 'bytes';
        }

        $contentLength = '';
        if ($statusCode === 206) {
            $contentLength = $meta['contentLength'];
            if ($meta['contentRange'] !== '') {
                $responseHeaders['Content-Range'] = $meta['contentRange'];
            }
        } elseif ($meta['status'] === 206 && $meta['contentRange'] !== '' && preg_match('#/(\d+)$#', $meta['contentRange'], $m)) {
            // Probe 206 (bytes=0-0) tapi kita streaming penuh → pakai total ukuran.
            $contentLength = $m[1];
        } else {
            $contentLength = $meta['contentLength'];
        }

        if ($contentLength !== '') {
            $responseHeaders['Content-Length'] = $contentLength;
        }

        // Pakai varian header yang sukses di probe (bisa tanpa Referer/Origin),
        // lalu terapkan Range client hanya jika upstream benar-benar membalas 206.
        $streamHeaders = array_values(array_filter(
            $meta['headers'],
            static fn (string $h) => !str_starts_with(strtolower($h), 'range:')
        ));
        if ($statusCode === 206 && $range) {
            $streamHeaders[] = 'Range: ' . $range;
        }

        return new StreamedResponse(function () use ($mediaUrl, $host, $port, $resolvedIp, $streamHeaders) {
            $ch = curl_init($mediaUrl);
            curl_setopt_array($ch, [
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_TIMEOUT => 0,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
                CURLOPT_HTTPHEADER => $streamHeaders,
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
        }, $statusCode, $responseHeaders);
    }

    /**
     * Probe upstream untuk membaca status, Content-Type, & dukungan Range.
     * GET mini (dengan Range tertentu) adalah probe utama — GET menunjukkan
     * realita Content-Type/Status secara akurat, sedangkan HEAD sering
     * mengabaikan Range atau diblokir CDN (karena itu HEAD hanya cadangan).
     * Content-Type di-cache per URL (TTL 60s).
     *
     * @return array{status: int, contentType: string, contentLength: string, contentRange: string, headers: list<string>}
     */
    private function probeUpstream(string $mediaUrl, string $host, int $port, string $resolvedIp, array $refererHeaders, array $cleanHeaders, string $probeRange): array
    {
        $cacheKey = $mediaUrl;
        $now = time();

        $meta = $this->probeWithRequest($mediaUrl, $host, $port, $resolvedIp, $refererHeaders, $probeRange);
        if (!$this->isValidProbe($meta)) {
            $meta = $this->probeWithRequest($mediaUrl, $host, $port, $resolvedIp, $cleanHeaders, $probeRange);
        }
        if (!$this->isValidProbe($meta)) {
            $meta = $this->probeWithRequest($mediaUrl, $host, $port, $resolvedIp, $cleanHeaders, null);
        }
        if (!$this->isValidProbe($meta)) {
            $meta = $this->probeWithRequest($mediaUrl, $host, $port, $resolvedIp, $refererHeaders, null);
        }

        $contentType = $meta['contentType'];
        if ($contentType !== '' && (!isset(self::$contentTypeCache[$cacheKey]) || $now - self::$contentTypeCache[$cacheKey]['ts'] >= self::CONTENT_TYPE_CACHE_TTL)) {
            self::$contentTypeCache[$cacheKey] = ['ts' => $now, 'type' => $contentType];
        } elseif ($contentType === '' && isset(self::$contentTypeCache[$cacheKey])) {
            $meta['contentType'] = self::$contentTypeCache[$cacheKey]['type'];
        }

        return $meta;
    }

    /**
     * Probe dianggap valid bila response 2xx/206 dan Content-Type benar-benar
     * media (bukan halaman error/html).
     */
    private function isValidProbe(array $meta): bool
    {
        if ($meta['status'] < 200 || $meta['status'] >= 300) {
            return false;
        }
        $ct = strtolower($meta['contentType']);
        if ($ct === '') {
            return false;
        }
        return !in_array($ct, ['text/html', 'text/plain', 'application/xml', 'application/json'], true);
    }

    /**
     * @param string|null $probeRange Range untuk GET mini, atau null → HEAD.
     *
     * @return array{status: int, contentType: string, contentLength: string, contentRange: string, headers: list<string>}
     */
    private function probeWithRequest(string $mediaUrl, string $host, int $port, string $resolvedIp, array $headers, ?string $probeRange): array
    {
        $status = 0;
        $respHeaders = [];

        $head = $probeRange === null;
        $probeHeaders = $headers;
        if (!$head) {
            $probeHeaders[] = 'Range: ' . $probeRange;
        }

        $opts = [
            CURLOPT_NOBODY => $head,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_RESOLVE => ["{$host}:{$port}:{$resolvedIp}"],
            CURLOPT_HTTPHEADER => $probeHeaders,
            CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$respHeaders) {
                $parts = explode(':', $header, 2);
                if (count($parts) === 2) {
                    $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($header);
            },
        ];

        if (!$head) {
            $opts[CURLOPT_WRITEFUNCTION] = function ($curl, $data) {
                return 0; // cukup header → hentikan transfer setelah byte pertama
            };
        }

        $ch = curl_init($mediaUrl);
        curl_setopt_array($ch, $opts);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return [
            'status' => $status,
            'contentType' => $respHeaders['content-type'] ?? '',
            'contentLength' => $respHeaders['content-length'] ?? '',
            'contentRange' => $respHeaders['content-range'] ?? '',
            'headers' => array_values(array_filter(
                $probeHeaders,
                static fn (string $h) => !str_starts_with(strtolower($h), 'range:')
            )),
        ];
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

    private function buildCleanHeaders(): array
    {
        return [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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