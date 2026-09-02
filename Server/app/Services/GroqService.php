<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GroqService
{
    protected string $apiKey;
    protected string $model;
    protected string $baseUrl;
    protected bool $isTemp = false;

    public function __construct()
    {
        /*
        |--------------------------------------------------------------------------
        | Provider Selection
        |--------------------------------------------------------------------------
        |
        | AI_TEMP_PROVIDER=true
        |     -> OpenRouter
        |
        | AI_TEMP_PROVIDER=false
        |     -> Groq
        |
        */

        $this->isTemp = filter_var(
            env('AI_TEMP_PROVIDER', false),
            FILTER_VALIDATE_BOOLEAN
        );

        if ($this->isTemp) {
            /*
            |--------------------------------------------------------------------------
            | OpenRouter
            |--------------------------------------------------------------------------
            */

            $this->apiKey = trim(
                (string) env('TEMP_KEY')
            );

            $this->model = trim(
                (string) env(
                    'TEMP_MODEL',
                    'openai/gpt-oss-20b'
                )
            );

            $this->baseUrl = trim(
                (string) env(
                    'TEMP_URL',
                    'https://openrouter.ai/api/v1/chat/completions'
                )
            );
        } else {
            /*
            |--------------------------------------------------------------------------
            | Groq
            |--------------------------------------------------------------------------
            */

            $this->apiKey = trim(
                (string) config('services.groq.api_key')
            );

            $this->model = trim(
                (string) config(
                    'services.groq.model',
                    'openai/gpt-oss-120b'
                )
            );

            $this->baseUrl =
                'https://api.groq.com/openai/v1/chat/completions';
        }

        /*
        |--------------------------------------------------------------------------
        | Validation
        |--------------------------------------------------------------------------
        */

        if ($this->apiKey === '') {
            throw new RuntimeException(
                $this->getProviderName() .
                ' API key is missing.'
            );
        }

        if ($this->model === '') {
            throw new RuntimeException(
                $this->getProviderName() .
                ' model is missing.'
            );
        }

        if ($this->baseUrl === '') {
            throw new RuntimeException(
                $this->getProviderName() .
                ' API URL is missing.'
            );
        }

        Log::info('AI provider initialized.', [
            'provider' => $this->getProviderName(),
            'temp_mode' => $this->isTemp,
            'model' => $this->model,
            'url' => $this->baseUrl,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Generate JSON
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | This method intentionally accepts:
    |
    | generateJson($prompt, $maxTokens)
    |
    | because that is how AiLessonController currently calls it.
    |
    */

    public function generateJson(
        string $prompt,
        int $maxTokens = 4000
    ): array {
        $maxAttempts = 3;

        for (
            $attempt = 1;
            $attempt <= $maxAttempts;
            $attempt++
        ) {
            try {
                /*
                |--------------------------------------------------------------------------
                | Messages
                |--------------------------------------------------------------------------
                */

                $messages = [
                    [
                        'role' => 'system',
                        'content' =>
                            'You are a precise educational AI assistant. '
                            . 'Follow the user instructions exactly. '
                            . 'Return only valid JSON when JSON is requested.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ];

                /*
                |--------------------------------------------------------------------------
                | Base payload
                |--------------------------------------------------------------------------
                */

                $payload = [
                    'model' => $this->model,

                    'messages' => $messages,

                    'temperature' => 0.4,

                    'response_format' => [
                        'type' => 'json_object',
                    ],
                ];

                /*
                |--------------------------------------------------------------------------
                | Token Parameter
                |--------------------------------------------------------------------------
                */

                if ($this->isTemp) {
                    /*
                    |--------------------------------------------------------------------------
                    | OpenRouter
                    |--------------------------------------------------------------------------
                    */

                    $payload['max_tokens'] = $maxTokens;
                } else {
                    /*
                    |--------------------------------------------------------------------------
                    | Groq
                    |--------------------------------------------------------------------------
                    */

                    $payload['max_completion_tokens'] = $maxTokens;

                    $payload['reasoning_effort'] = 'low';

                    $payload['include_reasoning'] = false;
                }

                /*
                |--------------------------------------------------------------------------
                | Headers
                |--------------------------------------------------------------------------
                */

                $headers = [
                    'Authorization' =>
                        'Bearer ' . $this->apiKey,

                    'Content-Type' =>
                        'application/json',
                ];

                /*
                |--------------------------------------------------------------------------
                | OpenRouter headers
                |--------------------------------------------------------------------------
                */

                if ($this->isTemp) {
                    $headers['HTTP-Referer'] =
                        config(
                            'app.url',
                            'http://localhost'
                        );

                    $headers['X-Title'] =
                        config(
                            'app.name',
                            'ProbLearn'
                        );
                }

                /*
                |--------------------------------------------------------------------------
                | Logging
                |--------------------------------------------------------------------------
                */

                Log::info(
                    'AI API request starting.',
                    [
                        'provider' =>
                            $this->getProviderName(),

                        'model' =>
                            $this->model,

                        'url' =>
                            $this->baseUrl,

                        'attempt' =>
                            $attempt,

                        'max_attempts' =>
                            $maxAttempts,

                        'max_tokens' =>
                            $maxTokens,

                        'prompt_chars' =>
                            mb_strlen($prompt),
                    ]
                );

                /*
                |--------------------------------------------------------------------------
                | Request
                |--------------------------------------------------------------------------
                */

                $response = Http::withHeaders(
                    $headers
                )
                    ->timeout(180)
                    ->connectTimeout(30)
                    ->post(
                        $this->baseUrl,
                        $payload
                    );

                $status =
                    $response->status();

                /*
                |--------------------------------------------------------------------------
                | Log response
                |--------------------------------------------------------------------------
                */

                Log::info(
                    'AI API response received.',
                    [
                        'provider' =>
                            $this->getProviderName(),

                        'model' =>
                            $this->model,

                        'status' =>
                            $status,

                        'attempt' =>
                            $attempt,
                    ]
                );

                /*
                |--------------------------------------------------------------------------
                | Success
                |--------------------------------------------------------------------------
                */

                if ($response->successful()) {
                    $responseData =
                        $response->json();

                    if (!is_array($responseData)) {
                        throw new RuntimeException(
                            'AI provider returned an invalid response.'
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Extract message
                    |--------------------------------------------------------------------------
                    */

                    $content =
                        $responseData[
                            'choices'
                        ][0][
                            'message'
                        ][
                            'content'
                        ] ?? null;

                    /*
                    |--------------------------------------------------------------------------
                    | Some providers may return content as array
                    |--------------------------------------------------------------------------
                    */

                    if (is_array($content)) {
                        $content =
                            $this->extractContentFromArray(
                                $content
                            );
                    }

                    if (
                        !is_string($content)
                        ||
                        trim($content) === ''
                    ) {
                        Log::error(
                            'AI provider returned empty content.',
                            [
                                'provider' =>
                                    $this->getProviderName(),

                                'model' =>
                                    $this->model,

                                'response' =>
                                    $responseData,
                            ]
                        );

                        throw new RuntimeException(
                            'AI provider returned empty content.'
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Parse JSON
                    |--------------------------------------------------------------------------
                    */

                    $decoded =
                        $this->parseJson(
                            $content
                        );

                    if ($decoded === null) {
                        throw new RuntimeException(
                            'AI provider returned invalid JSON.'
                        );
                    }

                    Log::info(
                        'AI JSON generation successful.',
                        [
                            'provider' =>
                                $this->getProviderName(),

                            'model' =>
                                $this->model,

                            'attempt' =>
                                $attempt,
                        ]
                    );

                    return $decoded;
                }

                /*
                |--------------------------------------------------------------------------
                | Rate limit
                |--------------------------------------------------------------------------
                */

                if ($status === 429) {
                    $body =
                        $response->body();

                    Log::warning(
                        'AI provider rate limit reached.',
                        [
                            'provider' =>
                                $this->getProviderName(),

                            'model' =>
                                $this->model,

                            'attempt' =>
                                $attempt,

                            'response' =>
                                $body,
                        ]
                    );

                    if (
                        $attempt <
                        $maxAttempts
                    ) {
                        $delay =
                            $this->getRetryDelay(
                                $response,
                                $attempt
                            );

                        sleep($delay);

                        continue;
                    }

                    throw new RuntimeException(
                        $this->getProviderName()
                        . ' rate limit exceeded after '
                        . $maxAttempts
                        . ' attempts. HTTP 429: '
                        . $body
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Server errors
                |--------------------------------------------------------------------------
                */

                if ($status >= 500) {
                    $body =
                        $response->body();

                    Log::warning(
                        'AI provider server error.',
                        [
                            'provider' =>
                                $this->getProviderName(),

                            'status' =>
                                $status,

                            'attempt' =>
                                $attempt,
                        ]
                    );

                    if (
                        $attempt <
                        $maxAttempts
                    ) {
                        sleep(
                            min(
                                3 * $attempt,
                                10
                            )
                        );

                        continue;
                    }

                    throw new RuntimeException(
                        $this->getProviderName()
                        . ' server error. HTTP '
                        . $status
                        . ': '
                        . $body
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Other errors
                |--------------------------------------------------------------------------
                */

                $body =
                    $response->body();

                Log::error(
                    'AI provider request failed.',
                    [
                        'provider' =>
                            $this->getProviderName(),

                        'model' =>
                            $this->model,

                        'status' =>
                            $status,

                        'response' =>
                            $body,
                    ]
                );

                throw new RuntimeException(
                    $this->getProviderName()
                    . ' API request failed. HTTP '
                    . $status
                    . ': '
                    . $body
                );

            } catch (Throwable $e) {

                /*
                |--------------------------------------------------------------------------
                | Final attempt
                |--------------------------------------------------------------------------
                */

                if (
                    $attempt >=
                    $maxAttempts
                ) {
                    Log::error(
                        'AI request failed permanently.',
                        [
                            'provider' =>
                                $this->getProviderName(),

                            'model' =>
                                $this->model,

                            'attempts' =>
                                $attempt,

                            'error' =>
                                $e->getMessage(),
                        ]
                    );

                    throw $e;
                }

                Log::warning(
                    'AI request exception. Retrying.',
                    [
                        'provider' =>
                            $this->getProviderName(),

                        'model' =>
                            $this->model,

                        'attempt' =>
                            $attempt,

                        'error' =>
                            $e->getMessage(),
                    ]
                );

                sleep(
                    min(
                        2 * $attempt,
                        5
                    )
                );
            }
        }

        throw new RuntimeException(
            'AI generation failed unexpectedly.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Parse JSON
    |--------------------------------------------------------------------------
    */

    protected function parseJson(
        string $content
    ): ?array {
        $content =
            trim($content);

        /*
        |--------------------------------------------------------------------------
        | Remove markdown fences
        |--------------------------------------------------------------------------
        */

        $content =
            preg_replace(
                '/^```(?:json)?\s*/i',
                '',
                $content
            );

        $content =
            preg_replace(
                '/\s*```$/',
                '',
                $content
            );

        $content =
            trim($content);

        /*
        |--------------------------------------------------------------------------
        | Direct decode
        |--------------------------------------------------------------------------
        */

        $decoded =
            json_decode(
                $content,
                true
            );

        if (
            json_last_error() ===
                JSON_ERROR_NONE
            &&
            is_array($decoded)
        ) {
            return $decoded;
        }

        /*
        |--------------------------------------------------------------------------
        | Try object extraction
        |--------------------------------------------------------------------------
        */

        $first =
            strpos(
                $content,
                '{'
            );

        $last =
            strrpos(
                $content,
                '}'
            );

        if (
            $first !== false
            &&
            $last !== false
            &&
            $last > $first
        ) {
            $json =
                substr(
                    $content,
                    $first,
                    $last - $first + 1
                );

            $decoded =
                json_decode(
                    $json,
                    true
                );

            if (
                json_last_error() ===
                    JSON_ERROR_NONE
                &&
                is_array($decoded)
            ) {
                return $decoded;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Try array extraction
        |--------------------------------------------------------------------------
        */

        $first =
            strpos(
                $content,
                '['
            );

        $last =
            strrpos(
                $content,
                ']'
            );

        if (
            $first !== false
            &&
            $last !== false
            &&
            $last > $first
        ) {
            $json =
                substr(
                    $content,
                    $first,
                    $last - $first + 1
                );

            $decoded =
                json_decode(
                    $json,
                    true
                );

            if (
                json_last_error() ===
                    JSON_ERROR_NONE
                &&
                is_array($decoded)
            ) {
                return $decoded;
            }
        }

        Log::warning(
            'Unable to parse AI JSON.',
            [
                'provider' =>
                    $this->getProviderName(),

                'content_preview' =>
                    mb_substr(
                        $content,
                        0,
                        2000
                    ),

                'json_error' =>
                    json_last_error_msg(),
            ]
        );

        return null;
    }

    /*
    |--------------------------------------------------------------------------
    | Extract content from array
    |--------------------------------------------------------------------------
    */

    protected function extractContentFromArray(
        array $content
    ): string {
        $text = '';

        foreach (
            $content as $part
        ) {
            if (
                is_string($part)
            ) {
                $text .= $part;
                continue;
            }

            if (
                is_array($part)
                &&
                isset(
                    $part['text']
                )
            ) {
                $text .=
                    (string)
                    $part['text'];
            }
        }

        return trim($text);
    }

    /*
    |--------------------------------------------------------------------------
    | Retry delay
    |--------------------------------------------------------------------------
    */

    protected function getRetryDelay(
        $response,
        int $attempt
    ): int {
        $retryAfter =
            $response->header(
                'Retry-After'
            );

        if (
            $retryAfter !== null
            &&
            is_numeric(
                $retryAfter
            )
        ) {
            return min(
                max(
                    (int) $retryAfter,
                    1
                ),
                60
            );
        }

        return min(
            3 * $attempt,
            15
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Provider
    |--------------------------------------------------------------------------
    */

    protected function getProviderName(): string
    {
        return $this->isTemp
            ? 'OpenRouter'
            : 'Groq';
    }

    /*
    |--------------------------------------------------------------------------
    | Public getters
    |--------------------------------------------------------------------------
    */

    public function getModel(): string
    {
        return $this->model;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function isTemp(): bool
    {
        return $this->isTemp;
    }

    public function getProvider(): string
    {
        return $this->getProviderName();
    }
}