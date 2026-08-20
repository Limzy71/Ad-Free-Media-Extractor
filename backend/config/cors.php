<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'chrome-extension://*',
        'http://localhost:3000',
        'http://localhost:5173',
    ],
    'allowed_origins_patterns' => [
        '/^chrome-extension:\/\/.+$/',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Content-Length', 'Content-Type'],
    'max_age' => 3600,
    'supports_credentials' => false,
];
