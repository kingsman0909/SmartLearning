<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiService
{
    public function generateJson(string $prompt): array
    {
        $apiKey = config('services.gemini.api_key');

        $model = config(
            'services.gemini.model',
            'gemini-3.6-flash'
        );

        if (!$apiKey) {
            throw new RuntimeException(
                'GEMINI_API_KEY is not configured.'
            );
        }

        $url =
            'https://generativelanguage.googleapis.com/v1beta/models/'
            . $model
            . ':generateContent';

        try {
            $response = Http::timeout(180)
                ->connectTimeout(30)
                ->withHeaders([
                    'x-goog-api-key' => $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, [
                    'contents' => [
                        [
                            'role' => 'user',
                            'parts' => [
                                [
                                    'text' => $prompt,
                                ],
                            ],
                        ],
                    ],

                    'generationConfig' => [
                        'responseMimeType' => 'application/json',
                    ],
                ]);
        } catch (\Throwable $e) {
            throw new RuntimeException(
                'Unable to connect to Gemini API: '
                . $e->getMessage(),
                0,
                $e
            );
        }

        if (!$response->successful()) {
            throw new RuntimeException(
                'Gemini API returned HTTP '
                . $response->status()
                . ': '
                . $response->body()
            );
        }

        $data = $response->json();

        $text =
            $data['candidates'][0]['content']['parts'][0]['text']
            ?? null;

        if (!$text) {
            throw new RuntimeException(
                'Gemini returned an empty response.'
            );
        }

        $text = trim($text);

        // Remove accidental Markdown code fences.
        $text = preg_replace(
            '/^```json\s*/i',
            '',
            $text
        );

        $text = preg_replace(
            '/^```\s*/',
            '',
            $text
        );

        $text = preg_replace(
            '/\s*```$/',
            '',
            $text
        );

        $text = trim($text);

        $json = json_decode($text, true);

        if (
            json_last_error() !== JSON_ERROR_NONE ||
            !is_array($json)
        ) {
            throw new RuntimeException(
                'Gemini returned invalid JSON: '
                . json_last_error_msg()
                . ' | Response: '
                . mb_substr($text, 0, 1000)
            );
        }

        return $json;
    }
}