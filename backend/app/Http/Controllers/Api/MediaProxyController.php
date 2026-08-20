<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

class MediaProxyController extends Controller
{
    private const ALLOWED_SCHEMES = ['http', 'https'];

    private const MAX_FILE_SIZE = 500 * 1024 * 1024;

    public function __invoke(Request $request): Response
    {
        $request->validate([
            'media_url' => 'required|url|max:4096',
            'referer' => 'nullable|string|max:2048',
        ]);

        $mediaUrl = $request->input('media_url');
        $urlObj = parse_url($mediaUrl);

        if (!in_array($urlObj['scheme'] ?? '', self::ALLOWED_SCHEMES, true)) {
            return response('URL scheme not allowed', 400);
        }

        $host = $urlObj['host'] ?? '';
        $resolvedIp = gethostbyname($host);

        if ($resolvedIp === $host || !$this->isPublicInternetIp($resolvedIp)) {
            return response('Access to internal/private network denied', 403);
        }

        $headers = [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ];

        $referer = $request->input('referer');
        if ($referer) {
            $headers['Referer'] = $referer;
        }

        try {
            $response = Http::withHeaders($headers)
                ->timeout(30)
                ->withOptions([
                    'stream' => true,
                ])
                ->get($mediaUrl);

            if (!$response->successful()) {
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
                    'Access-Control-Allow-Headers' => 'Content-Type, Referer',
                    'Cache-Control' => 'public, max-age=3600',
                ]
            );

            $contentLength = $response->header('Content-Length');
            if ($contentLength) {
                $streamedResponse->header('Content-Length', min($contentLength, self::MAX_FILE_SIZE));
            }

            return $streamedResponse;
        } catch (\Exception) {
            return response('Proxy request failed', 502);
        }
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
