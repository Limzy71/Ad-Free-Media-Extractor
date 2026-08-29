<?php

use App\Http\Controllers\Api\AdBlockRulesController;
use App\Http\Controllers\Api\LinkVerifierController;
use App\Http\Controllers\Api\MediaProxyController;
use Illuminate\Support\Facades\Route;

Route::post('/v1/verify-link', LinkVerifierController::class)
    ->middleware('throttle:60,1');

Route::match(['get', 'post', 'options'], '/v1/proxy-media', MediaProxyController::class);

Route::get('/v1/rules/blocklist', AdBlockRulesController::class)
    ->middleware('throttle:120,1');