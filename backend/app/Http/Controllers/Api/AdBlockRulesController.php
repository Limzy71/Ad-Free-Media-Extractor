<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AdBlockRulesController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rules = [
            [
                'id' => 1,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||doubleclick.net',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest', 'sub_frame'],
                ],
            ],
            [
                'id' => 2,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||googlesyndication.com',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest', 'sub_frame'],
                ],
            ],
            [
                'id' => 3,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||googleadservices.com',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest'],
                ],
            ],
            [
                'id' => 4,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||facebook.com/tr',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest'],
                ],
            ],
            [
                'id' => 5,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||analytics.google.com',
                    'resourceTypes' => ['script', 'xmlhttprequest'],
                ],
            ],
            [
                'id' => 6,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||pagead2.googlesyndication.com',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest', 'sub_frame'],
                ],
            ],
            [
                'id' => 7,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||amazon-adsystem.com',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest'],
                ],
            ],
            [
                'id' => 8,
                'priority' => 1,
                'action' => ['type' => 'block'],
                'condition' => [
                    'urlFilter' => '||adskeeper.com',
                    'resourceTypes' => ['script', 'image', 'xmlhttprequest', 'sub_frame'],
                ],
            ],
        ];

        return response()->json([
            'version' => '1.0.0',
            'rules' => $rules,
        ]);
    }
}
