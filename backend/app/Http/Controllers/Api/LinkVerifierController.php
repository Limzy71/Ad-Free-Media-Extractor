<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class LinkVerifierController extends Controller
{
    private const BLOCKED_DOMAINS = [
        'slot88' => 'gambling',
        'judionline' => 'gambling',
        'gacor' => 'gambling',
        'sbobet' => 'gambling',
        'poker88' => 'gambling',
        'togel' => 'gambling',
        'maxwin' => 'gambling',
        'pragmaticplay' => 'gambling',
        'casino-online' => 'gambling',
        'bet365-fake' => 'gambling',
        'bandarqq' => 'gambling',
        'domino99' => 'gambling',
        'login-verify-account' => 'phishing',
        'paypal-security-update' => 'phishing',
        'bca-klik-fake' => 'phishing',
        'mandiri-online-secure' => 'phishing',
        'phishing-test' => 'phishing',
        'free-giftcard-claim' => 'phishing',
        'malware-domain' => 'malware',
        'trojan-download' => 'malware',
        'ransomware-server' => 'malware',
        'virus-installer' => 'malware',
    ];

    private const RISK_SCORES = [
        'gambling' => 95,
        'phishing' => 90,
        'malware' => 99,
    ];

    private const CACHE_TTL = 3600;

    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'url' => [
                'required',
                'string',
                'max:2048',
                'regex:/^https?:\/\//i',
            ],
        ]);

        $url = $request->input('url');
        $urlObj = parse_url($url);
        $domain = strtolower($urlObj['host'] ?? '');

        $cacheKey = "verify:" . md5($url);
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return response()->json([
                'status' => 'success',
                'data' => $cached,
            ]);
        }

        $threatCategory = null;
        $riskScore = 0;

        foreach (self::BLOCKED_DOMAINS as $keyword => $category) {
            if (str_contains($domain, $keyword) || str_contains($url, $keyword)) {
                $threatCategory = $category;
                $riskScore = self::RISK_SCORES[$category] ?? 50;
                break;
            }
        }

        if ($threatCategory === null && config('services.google_safe_browsing.key')) {
            $result = $this->checkGoogleSafeBrowsing($url);
            if ($result !== null) {
                $threatCategory = $result['threat'];
                $riskScore = $result['score'];
            }
        }

        $response = [
            'url' => $url,
            'domain' => $domain,
            'is_safe' => $threatCategory === null,
            'threat_category' => $threatCategory,
            'risk_score' => $riskScore,
        ];

        Cache::put($cacheKey, $response, self::CACHE_TTL);

        return response()->json([
            'status' => 'success',
            'data' => $response,
        ]);
    }

    private function checkGoogleSafeBrowsing(string $url): ?array
    {
        $apiKey = config('services.google_safe_browsing.key');
        if (!$apiKey) {
            return null;
        }

        try {
            $response = Http::timeout(3)
                ->post("https://safebrowsing.googleapis.com/v4/threatMatches:find?key={$apiKey}", [
                    'client' => [
                        'clientId' => 'universal-ad-free-media-extractor',
                        'clientVersion' => '1.0.0',
                    ],
                    'threatInfo' => [
                        'threatTypes' => ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                        'platformTypes' => ['ANY_PLATFORM'],
                        'threatEntryTypes' => ['URL'],
                        'threatEntries' => [['url' => $url]],
                    ],
                ]);

            if ($response->successful()) {
                $matches = $response->json('matches', []);
                if (!empty($matches)) {
                    $threatType = $matches[0]['threatType'] ?? 'UNKNOWN';
                    $categoryMap = [
                        'MALWARE' => 'malware',
                        'SOCIAL_ENGINEERING' => 'phishing',
                        'UNWANTED_SOFTWARE' => 'malware',
                    ];
                    $category = $categoryMap[$threatType] ?? 'suspicious';
                    return [
                        'threat' => $category,
                        'score' => 80,
                    ];
                }
            }
        } catch (\Exception) {
            // Fail open — if Safe Browsing is unreachable, don't block
        }

        return null;
    }
}
