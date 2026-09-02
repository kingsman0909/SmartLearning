<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GroqService
{
    protected string $apiKey;

    protected string $model;

    protected string $baseUrl =
        'https://api.groq.com/openai/v1/chat/completions';

    /**
     * Maximum number of attempts for transient errors.
     */
    protected int $maxAttempts = 5;

    /**
     * Maximum delay between retries.
     */
    protected int $maxBackoffSeconds = 30;

    public function __construct()
    {
        $this->apiKey = (string) config(
            'services.groq.api_key'
        );

        $this->model = (string) config(
            'services.groq.model',
            'openai/gpt-oss-120b'
        );

        if ($this->apiKey === '') {
            throw new RuntimeException(
                'GROQ_API_KEY is not configured.'
            );
        }
    }

    /**
     * Generate a JSON response using Groq.
     *
     * This method is intentionally resilient against:
     *
     * - 429 rate limits
     * - 500/502/503/504 server errors
     * - 520 upstream errors
     * - temporary connection errors
     *
     * It uses exponential backoff + jitter.
     */
    public function generateJson(
        string $prompt,
        ?int $maxCompletionTokens = null
    ): array {
        $maxCompletionTokens ??= 1500;

        $maxCompletionTokens = max(
            256,
            min($maxCompletionTokens, 6500)
        );

        $lastException = null;

        for (
            $attempt = 1;
            $attempt <= $this->maxAttempts;
            $attempt++
        ) {
            Log::info(
                'Groq API request starting.',
                [
                    'model' => $this->model,
                    'attempt' => $attempt,
                    'max_attempts' => $this->maxAttempts,
                    'max_completion_tokens' =>
                        $maxCompletionTokens,
                    'prompt_chars' =>
                        mb_strlen($prompt),
                ]
            );

            try {
                $response = Http::withToken(
                    $this->apiKey
                )
                    ->acceptJson()
                    ->timeout(180)
                    ->connectTimeout(30)
                    ->retry(
                        0,
                        0
                    )
                    ->post(
                        $this->baseUrl,
                        [
                            'model' => $this->model,

                            'messages' => [
                                [
                                    'role' => 'system',
                                    'content' =>
                                        'You are an educational content generator. '
                                        . 'Follow the user instructions exactly. '
                                        . 'Return ONLY valid JSON. '
                                        . 'Never use markdown fences. '
                                        . 'Never include commentary outside the JSON.',
                                ],
                                [
                                    'role' => 'user',
                                    'content' => $prompt,
                                ],
                            ],

                            'temperature' => 0.2,

                            'reasoning_effort' => 'low',

                            'include_reasoning' => false,

                            'max_completion_tokens' =>
                                $maxCompletionTokens,

                            'response_format' => [
                                'type' => 'json_object',
                            ],
                        ]
                    );

                /**
                 * Successful HTTP response.
                 */
                if ($response->successful()) {
                    return $this->parseJsonResponse(
                        $response,
                        $attempt
                    );
                }

                $status = $response->status();

                $body = $response->body();

                Log::warning(
                    'Groq API returned non-success status.',
                    [
                        'status' => $status,
                        'attempt' => $attempt,
                        'model' => $this->model,
                        'body' => mb_substr(
                            $body,
                            0,
                            5000
                        ),
                    ]
                );

                /**
                 * Never retry permanent request errors.
                 */
                if (
                    $status === 400 ||
                    $status === 401 ||
                    $status === 403 ||
                    $status === 413
                ) {
                    throw $this->createPermanentException(
                        $response
                    );
                }

                /**
                 * Rate limit.
                 */
                if ($status === 429) {
                    if (
                        $attempt >=
                        $this->maxAttempts
                    ) {
                        throw new RuntimeException(
                            'Groq rate limit exceeded after '
                            . $this->maxAttempts
                            . ' attempts. '
                            . 'The request was not completed. '
                            . 'HTTP 429: '
                            . mb_substr(
                                $body,
                                0,
                                2000
                            )
                        );
                    }

                    $delay =
                        $this->getRetryDelay(
                            $response,
                            $attempt
                        );

                    Log::warning(
                        'Groq rate limit detected. Retrying with backoff.',
                        [
                            'status' => $status,
                            'attempt' => $attempt,
                            'delay_seconds' => $delay,
                        ]
                    );

                    sleep($delay);

                    continue;
                }

                /**
                 * Any 5xx error is considered transient.
                 *
                 * This includes:
                 *
                 * 500
                 * 502
                 * 503
                 * 504
                 * 520
                 * etc.
                 */
                if (
                    $status >= 500 &&
                    $status <= 599
                ) {
                    if (
                        $attempt >=
                        $this->maxAttempts
                    ) {
                        throw new RuntimeException(
                            'Groq server error after '
                            . $this->maxAttempts
                            . ' attempts. '
                            . 'HTTP '
                            . $status
                            . ': '
                            . mb_substr(
                                $body,
                                0,
                                3000
                            )
                        );
                    }

                    $delay =
                        $this->calculateBackoff(
                            $attempt
                        );

                    Log::warning(
                        'Groq transient server error. Retrying.',
                        [
                            'status' => $status,
                            'attempt' => $attempt,
                            'delay_seconds' => $delay,
                        ]
                    );

                    sleep($delay);

                    continue;
                }

                /**
                 * Other HTTP errors.
                 */
                throw new RuntimeException(
                    'Groq API returned HTTP '
                    . $status
                    . ': '
                    . mb_substr(
                        $body,
                        0,
                        3000
                    )
                );
            } catch (Throwable $e) {
                $lastException = $e;

                /**
                 * Permanent errors should immediately stop.
                 */
                if (
                    $this->isPermanentError(
                        $e
                    )
                ) {
                    throw $e;
                }

                /**
                 * Last attempt.
                 */
                if (
                    $attempt >=
                    $this->maxAttempts
                ) {
                    throw $e;
                }

                $delay =
                    $this->calculateBackoff(
                        $attempt
                    );

                Log::warning(
                    'Groq request exception. Retrying.',
                    [
                        'attempt' => $attempt,
                        'delay_seconds' => $delay,
                        'message' => $e->getMessage(),
                    ]
                );

                sleep($delay);
            }
        }

        throw $lastException
            ?? new RuntimeException(
                'Groq request failed unexpectedly.'
            );
    }

    /**
     * Parse and validate Groq JSON response.
     */
    protected function parseJsonResponse(
        Response $response,
        int $attempt
    ): array {
        $body = $response->json();

        $content = data_get(
            $body,
            'choices.0.message.content'
        );

        if (
            !is_string($content) ||
            trim($content) === ''
        ) {
            throw new RuntimeException(
                'Groq returned an empty response.'
            );
        }

        $content = trim($content);

        /**
         * Remove accidental markdown fences.
         */
        $content = preg_replace(
            '/^```(?:json)?\s*/i',
            '',
            $content
        );

        $content = preg_replace(
            '/\s*```$/',
            '',
            $content
        );

        $content = trim($content);

        $decoded = json_decode(
            $content,
            true
        );

        if (
            json_last_error() !==
            JSON_ERROR_NONE ||
            !is_array($decoded)
        ) {
            Log::error(
                'Groq returned invalid JSON.',
                [
                    'attempt' => $attempt,
                    'json_error' =>
                        json_last_error_msg(),
                    'content_preview' =>
                        mb_substr(
                            $content,
                            0,
                            3000
                        ),
                ]
            );

            throw new RuntimeException(
                'Groq returned invalid JSON: '
                . json_last_error_msg()
            );
        }

        Log::info(
            'Groq API request successful.',
            [
                'model' => $this->model,
                'attempt' => $attempt,
            ]
        );

        return $decoded;
    }

    /**
     * Retry-After aware delay for HTTP 429.
     */
    protected function getRetryDelay(
        Response $response,
        int $attempt
    ): int {
        $retryAfter = $response->header(
            'retry-after'
        );

        if (
            is_numeric($retryAfter)
        ) {
            return max(
                1,
                min(
                    (int) ceil(
                        (float) $retryAfter
                    ),
                    $this->maxBackoffSeconds
                )
            );
        }

        return $this->calculateBackoff(
            $attempt
        );
    }

    /**
     * Exponential backoff + jitter.
     *
     * Example:
     *
     * attempt 1 -> 2-3 sec
     * attempt 2 -> 4-5 sec
     * attempt 3 -> 8-9 sec
     * attempt 4 -> 16-17 sec
     */
    protected function calculateBackoff(
        int $attempt
    ): int {
        $base = min(
            2 ** $attempt,
            $this->maxBackoffSeconds
        );

        $jitter = random_int(
            0,
            1000
        ) / 1000;

        return (int) ceil(
            min(
                $base + $jitter,
                $this->maxBackoffSeconds
            )
        );
    }

    /**
     * Create a useful exception for permanent HTTP errors.
     */
    protected function createPermanentException(
        Response $response
    ): RuntimeException {
        $status = $response->status();

        $body = $response->body();

        $errorData = json_decode(
            $body,
            true
        );

        $errorMessage = data_get(
            $errorData,
            'error.message'
        );

        if (
            !is_string($errorMessage) ||
            trim($errorMessage) === ''
        ) {
            $errorMessage =
                mb_substr(
                    $body,
                    0,
                    2000
                );
        }

        if ($status === 413) {
            return new RuntimeException(
                'Groq request exceeded the current token/request limit. '
                . $errorMessage
            );
        }

        if (
            $status === 401 ||
            $status === 403
        ) {
            return new RuntimeException(
                'Groq authentication/permission error. '
                . 'Check GROQ_API_KEY and model permissions.'
            );
        }

        if ($status === 400) {
            return new RuntimeException(
                'Groq rejected the request: '
                . $errorMessage
            );
        }

        return new RuntimeException(
            'Groq API error HTTP '
            . $status
            . ': '
            . $errorMessage
        );
    }

    /**
     * Determine whether an exception should not be retried.
     */
    protected function isPermanentError(
        Throwable $e
    ): bool {
        $message = strtolower(
            $e->getMessage()
        );

        return
            str_contains(
                $message,
                'authentication/permission'
            ) ||
            str_contains(
                $message,
                'request exceeded'
            ) ||
            str_contains(
                $message,
                'rejected the request'
            ) ||
            str_contains(
                $message,
                'http 400'
            ) ||
            str_contains(
                $message,
                'http 401'
            ) ||
            str_contains(
                $message,
                'http 403'
            ) ||
            str_contains(
                $message,
                'http 413'
            );
    }

    public function getModel(): string
    {
        return $this->model;
    }
}