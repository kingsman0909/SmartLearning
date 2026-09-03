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
    protected string $url;
    protected string $model;

    /**
     * All configured models.
     *
     * Example:
     * TEMP_MODELS=model-a,model-b,model-c
     */
    protected array $models = [];

    protected int $timeout;
    protected int $connectTimeout;
    protected int $maxRetries;
    protected int $retryDelay;

    protected bool $useTempProvider = false;

    public function __construct()
    {
        $this->useTempProvider = filter_var(
            env('AI_TEMP_PROVIDER', false),
            FILTER_VALIDATE_BOOLEAN
        );

        if ($this->useTempProvider) {
            $this->apiKey = trim((string) env('TEMP_KEY', ''));

            $this->url = trim((string) env(
                'TEMP_URL',
                'https://api.groq.com/openai/v1/chat/completions'
            ));

            $this->model = trim((string) env('TEMP_MODEL', ''));

            $configuredModels = trim(
                (string) env('TEMP_MODELS', '')
            );

            if ($configuredModels !== '') {
                $this->models = array_values(
                    array_unique(
                        array_filter(
                            array_map(
                                'trim',
                                explode(',', $configuredModels)
                            ),
                            fn ($model) => $model !== ''
                        )
                    )
                );
            }

            /*
             * Fallback to TEMP_MODEL when TEMP_MODELS
             * is not configured.
             */
            if (empty($this->models) && $this->model !== '') {
                $this->models = [$this->model];
            }
        } else {
            $this->apiKey = trim(
                (string) env('GEMINI_API_KEY', '')
            );

            $this->url = trim(
                (string) env(
                    'GEMINI_API_URL',
                    'https://generativelanguage.googleapis.com/v1beta/models'
                )
            );

            $this->model = trim(
                (string) env(
                    'GEMINI_MODEL',
                    'gemini-3.6-flash'
                )
            );

            $this->models = [$this->model];
        }

        $this->timeout = max(
            5,
            (int) env('AI_TIMEOUT', 45)
        );

        $this->connectTimeout = max(
            2,
            (int) env('AI_CONNECT_TIMEOUT', 8)
        );

        $this->maxRetries = max(
            0,
            (int) env('AI_MAX_RETRIES', 0)
        );

        $this->retryDelay = max(
            100,
            (int) env('AI_RETRY_DELAY_MS', 300)
        );

        Log::info('GroqService initialized', [
            'provider' => $this->useTempProvider
                ? 'temporary'
                : 'gemini',
            'url' => $this->url,
            'model' => $this->model,
            'models' => $this->models,
            'timeout' => $this->timeout,
            'connect_timeout' => $this->connectTimeout,
            'max_retries' => $this->maxRetries,
        ]);
    }

    /**
     * Generate JSON from the configured AI provider.
     *
     * IMPORTANT:
     * - 429 => immediately move to NEXT model.
     * - Never waits on a 429.
     * - Retries the SAME model only for transient errors.
     * - If all models fail, throws one final exception.
     */
    public function generateJson(
        string $prompt,
        ?int $maxTokens = null
    ): array {
        if ($this->apiKey === '') {
            throw new RuntimeException(
                'AI API key is missing.'
            );
        }

        if (empty($this->models)) {
            throw new RuntimeException(
                'No AI models are configured.'
            );
        }

        $maxTokens = $maxTokens !== null
            ? max(1, $maxTokens)
            : null;

        $lastException = null;
        $failedModels = [];

        /*
         * OUTER LOOP:
         *
         * Each model gets its own chance.
         *
         * Example:
         *
         * GLM -> 429
         *       ↓
         * Nemotron -> 429
         *       ↓
         * GPT-OSS -> success
         *
         * No waiting between models.
         */
        foreach ($this->models as $modelIndex => $model) {
            $model = trim($model);

            if ($model === '') {
                continue;
            }

            $attempts = $this->maxRetries + 1;

            for ($attempt = 1; $attempt <= $attempts; $attempt++) {
                try {
                    Log::info(
                        'AI REQUEST START',
                        [
                            'provider' => $this->useTempProvider
                                ? 'openrouter'
                                : 'gemini',
                            'model' => $model,
                            'model_index' => $modelIndex + 1,
                            'total_models' => count($this->models),
                            'attempt' => $attempt,
                            'max_attempts' => $attempts,
                        ]
                    );

                    $response = $this->sendRequest(
                        $model,
                        $prompt,
                        $maxTokens
                    );

                    if (!$response->successful()) {
                        $status = $response->status();
                        $body = $response->body();

                        $retryAfter =
                            $this->getRetryAfterSeconds(
                                $response
                            );

                        Log::warning(
                            'AI HTTP REQUEST FAILED',
                            [
                                'provider' =>
                                    $this->useTempProvider
                                        ? 'openrouter'
                                        : 'gemini',
                                'model' => $model,
                                'model_index' => $modelIndex + 1,
                                'status' => $status,
                                'attempt' => $attempt,
                                'retry_after' => $retryAfter,
                                'body' => mb_substr(
                                    $body,
                                    0,
                                    2000
                                ),
                            ]
                        );

                        /*
                         * 429 IS SPECIAL.
                         *
                         * Do NOT retry the current model.
                         * Do NOT sleep.
                         * Immediately continue to the next model.
                         */
                        if ($status === 429) {
                            throw new RuntimeException(
                                'AI_MODEL_RATE_LIMITED: ' .
                                $model .
                                ' returned HTTP 429.'
                            );
                        }

                        throw new RuntimeException(
                            "AI provider returned HTTP {$status}: {$body}"
                        );
                    }

                    $result = $this->extractJsonFromResponse(
                        $response,
                        $model
                    );

                    Log::info(
                        'AI REQUEST SUCCESS',
                        [
                            'provider' =>
                                $this->useTempProvider
                                    ? 'openrouter'
                                    : 'gemini',
                            'model' => $model,
                            'model_index' => $modelIndex + 1,
                            'attempt' => $attempt,
                        ]
                    );

                    return $result;
                } catch (Throwable $e) {
                    $lastException = $e;

                    /*
                     * RATE LIMIT:
                     *
                     * Immediately abandon this model.
                     * The outer foreach will select the next one.
                     */
                    if (
                        $this->isRateLimitException($e)
                    ) {
                        $failedModels[] = [
                            'model' => $model,
                            'reason' => 'rate_limited',
                        ];

                        $nextModel =
                            $this->models[$modelIndex + 1]
                            ?? null;

                        Log::warning(
                            'AI RATE LIMIT - MOVING TO NEXT MODEL',
                            [
                                'current_model' => $model,
                                'current_model_index' =>
                                    $modelIndex + 1,
                                'next_model' => $nextModel,
                                'next_model_index' =>
                                    $nextModel !== null
                                        ? $modelIndex + 2
                                        : null,
                                'total_models' =>
                                    count($this->models),
                                'attempt' => $attempt,
                            ]
                        );

                        /*
                         * IMPORTANT:
                         * Break ONLY the inner retry loop.
                         *
                         * The outer foreach continues to
                         * the next configured model.
                         */
                        break;
                    }

                    /*
                     * Retry transient errors on the SAME model.
                     *
                     * Examples:
                     * - timeout
                     * - connection failure
                     * - 408
                     * - 500
                     * - 502
                     * - 503
                     * - 504
                     */
                    if (
                        $attempt < $attempts &&
                        $this->shouldRetry($e)
                    ) {
                        $delay =
                            $this->retryDelay *
                            $attempt;

                        Log::warning(
                            'AI TRANSIENT ERROR - RETRYING SAME MODEL',
                            [
                                'model' => $model,
                                'attempt' => $attempt,
                                'next_attempt' =>
                                    $attempt + 1,
                                'delay_ms' => $delay,
                                'error' => $e->getMessage(),
                            ]
                        );

                        usleep($delay * 1000);

                        continue;
                    }

                    /*
                     * Current model failed for a non-rate-limit
                     * reason. Move to the next model.
                     */
                    $failedModels[] = [
                        'model' => $model,
                        'reason' => $e->getMessage(),
                    ];

                    $nextModel =
                        $this->models[$modelIndex + 1]
                        ?? null;

                    Log::warning(
                        'AI MODEL FAILED - MOVING TO NEXT MODEL',
                        [
                            'current_model' => $model,
                            'current_model_index' =>
                                $modelIndex + 1,
                            'next_model' => $nextModel,
                            'next_model_index' =>
                                $nextModel !== null
                                    ? $modelIndex + 2
                                    : null,
                            'error' => $e->getMessage(),
                        ]
                    );

                    break;
                }
            }
        }

        /*
         * Every configured model failed.
         */
        $modelNames = implode(
            ', ',
            array_map(
                fn ($model) => (string) $model,
                $this->models
            )
        );

        $lastMessage = $lastException
            ? $lastException->getMessage()
            : 'Unknown AI error.';

        Log::error(
            'ALL AI MODELS FAILED',
            [
                'models' => $this->models,
                'failed_models' => $failedModels,
                'last_error' => $lastMessage,
            ]
        );

        throw new RuntimeException(
            'All configured AI models failed. ' .
            'Models tried: ' .
            $modelNames .
            '. Last error: ' .
            $lastMessage
        );
    }

    /**
     * Send request to provider.
     */
    protected function sendRequest(
        string $model,
        string $prompt,
        ?int $maxTokens
    ): Response {
        /*
         * TEMP PROVIDER / OPENROUTER
         */
        if ($this->useTempProvider) {
            $payload = [
                'model' => $model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' =>
                            'You are a precise educational ' .
                            'content generator. ' .
                            'Return only valid JSON matching ' .
                            'the requested structure. ' .
                            'Do not include Markdown, code fences, ' .
                            'commentary, or explanations outside ' .
                            'the JSON.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.2,
            ];

            if ($maxTokens !== null) {
                $payload['max_tokens'] = $maxTokens;
            }

            $http = Http::timeout($this->timeout)
                ->connectTimeout($this->connectTimeout)
                ->withToken($this->apiKey)
                ->acceptJson()
                ->asJson();

            /*
             * OpenRouter headers.
             */
            if ($this->isUsingOpenRouter()) {
                $http = $http->withHeaders([
                    'HTTP-Referer' => config(
                        'app.url',
                        'http://localhost'
                    ),
                    'X-Title' => 'ProbLearn',
                ]);
            }

            return $http->post(
                $this->url,
                $payload
            );
        }

        /*
         * GEMINI
         */
        $geminiUrl = $this->buildGeminiUrl(
            $model
        );

        $payload = [
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
                'temperature' => 0.2,
                'responseMimeType' => 'application/json',
            ],
        ];

        if ($maxTokens !== null) {
            $payload['generationConfig'][
                'maxOutputTokens'
            ] = $maxTokens;
        }

        return Http::timeout($this->timeout)
            ->connectTimeout($this->connectTimeout)
            ->acceptJson()
            ->asJson()
            ->withQueryParameters([
                'key' => $this->apiKey,
            ])
            ->post(
                $geminiUrl,
                $payload
            );
    }

    /**
     * Extract JSON from provider response.
     */
    protected function extractJsonFromResponse(
        Response $response,
        string $model
    ): array {
        $body = $response->body();

        if (trim($body) === '') {
            throw new RuntimeException(
                "AI returned empty response from model {$model}."
            );
        }

        $json = $response->json();

        /*
         * OPENROUTER / OPENAI COMPATIBLE
         */
        if ($this->useTempProvider) {
            $content = null;

            if (
                isset($json['choices'][0]['message']['content'])
            ) {
                $content =
                    $json['choices'][0]['message']['content'];
            }

            /*
             * Some providers may return content as an array
             * of structured blocks.
             */
            if (is_array($content)) {
                $parts = [];

                foreach ($content as $block) {
                    if (is_string($block)) {
                        $parts[] = $block;
                        continue;
                    }

                    if (
                        is_array($block) &&
                        isset($block['text'])
                    ) {
                        $parts[] = $block['text'];
                    }

                    if (
                        is_array($block) &&
                        isset($block['content'])
                    ) {
                        $parts[] =
                            is_string($block['content'])
                                ? $block['content']
                                : json_encode(
                                    $block['content']
                                );
                    }
                }

                $content = implode('', $parts);
            }

            /*
             * Fallbacks for OpenAI-compatible providers.
             */
            if (
                ($content === null || $content === '') &&
                isset($json['output_text'])
            ) {
                $content = $json['output_text'];
            }

            if (
                ($content === null || $content === '') &&
                isset($json['response'])
            ) {
                $content = $json['response'];
            }

            if (
                ($content === null || $content === '') &&
                isset($json['content'])
            ) {
                $content = $json['content'];
            }

            if (
                !is_string($content) ||
                trim($content) === ''
            ) {
                Log::warning(
                    'AI RESPONSE HAS NO USABLE CONTENT',
                    [
                        'model' => $model,
                        'body' => mb_substr(
                            $body,
                            0,
                            3000
                        ),
                    ]
                );

                throw new RuntimeException(
                    "AI returned empty content from model {$model}."
                );
            }

            return $this->parseGeneratedJson(
                $content,
                $model
            );
        }

        /*
         * GEMINI RESPONSE
         */
        $content = null;

        if (
            isset(
                $json['candidates'][0]['content']['parts'][0]['text']
            )
        ) {
            $content =
                $json['candidates'][0]['content']['parts'][0]['text'];
        }

        /*
         * Gemini may sometimes return multiple parts.
         */
        if (
            $content === null &&
            isset($json['candidates'][0]['content']['parts'])
        ) {
            $parts = [];

            foreach (
                $json['candidates'][0]['content']['parts']
                as $part
            ) {
                if (
                    is_array($part) &&
                    isset($part['text'])
                ) {
                    $parts[] = $part['text'];
                }
            }

            if (!empty($parts)) {
                $content = implode('', $parts);
            }
        }

        if (
            !is_string($content) ||
            trim($content) === ''
        ) {
            Log::warning(
                'GEMINI RESPONSE HAS NO USABLE CONTENT',
                [
                    'model' => $model,
                    'body' => mb_substr(
                        $body,
                        0,
                        3000
                    ),
                ]
            );

            throw new RuntimeException(
                "AI returned empty content from model {$model}."
            );
        }

        return $this->parseGeneratedJson(
            $content,
            $model
        );
    }

    /**
     * Parse AI-generated JSON safely.
     */
    protected function parseGeneratedJson(
        string $content,
        string $model
    ): array {
        $content = trim($content);

        /*
         * Remove UTF-8 BOM.
         */
        $content = preg_replace(
            '/^\xEF\xBB\xBF/',
            '',
            $content
        );

        /*
         * Remove Markdown code fences.
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

        /*
         * First attempt: direct JSON.
         */
        $decoded = json_decode(
            $content,
            true
        );

        if (
            json_last_error() === JSON_ERROR_NONE &&
            is_array($decoded)
        ) {
            return $this->normalizeGeneratedJson(
                $decoded
            );
        }

        /*
         * Attempt to extract JSON object.
         */
        $objectStart = strpos(
            $content,
            '{'
        );

        $objectEnd = strrpos(
            $content,
            '}'
        );

        if (
            $objectStart !== false &&
            $objectEnd !== false &&
            $objectEnd > $objectStart
        ) {
            $objectJson = substr(
                $content,
                $objectStart,
                $objectEnd - $objectStart + 1
            );

            $decoded = json_decode(
                $objectJson,
                true
            );

            if (
                json_last_error() === JSON_ERROR_NONE &&
                is_array($decoded)
            ) {
                return $this->normalizeGeneratedJson(
                    $decoded
                );
            }
        }

        /*
         * Attempt to extract JSON array.
         */
        $arrayStart = strpos(
            $content,
            '['
        );

        $arrayEnd = strrpos(
            $content,
            ']'
        );

        if (
            $arrayStart !== false &&
            $arrayEnd !== false &&
            $arrayEnd > $arrayStart
        ) {
            $arrayJson = substr(
                $content,
                $arrayStart,
                $arrayEnd - $arrayStart + 1
            );

            $decoded = json_decode(
                $arrayJson,
                true
            );

            if (
                json_last_error() === JSON_ERROR_NONE &&
                is_array($decoded)
            ) {
                return $this->normalizeGeneratedJson(
                    $decoded
                );
            }
        }

        Log::warning(
            'AI RETURNED INVALID JSON',
            [
                'model' => $model,
                'json_error' => json_last_error_msg(),
                'content_preview' => mb_substr(
                    $content,
                    0,
                    5000
                ),
            ]
        );

        throw new RuntimeException(
            "AI returned invalid JSON from model {$model}: " .
            json_last_error_msg()
        );
    }

    /**
     * Normalize different AI JSON wrappers into a
     * predictable array.
     */
    protected function normalizeGeneratedJson(
        array $decoded
    ): array {
        /*
         * Already a direct question list.
         */
        if (
            $this->looksLikeQuestionList(
                $decoded
            )
        ) {
            return [
                'questions' => array_values(
                    $decoded
                ),
            ];
        }

        /*
         * Standard wrapper:
         *
         * {
         *   "questions": [...]
         * }
         */
        if (
            isset($decoded['questions']) &&
            is_array($decoded['questions'])
        ) {
            return [
                'questions' => array_values(
                    $decoded['questions']
                ),
            ];
        }

        /*
         * Other common wrappers.
         */
        $wrappers = [
            'data',
            'items',
            'results',
            'question_list',
            'questionList',
        ];

        foreach ($wrappers as $wrapper) {
            if (
                isset($decoded[$wrapper]) &&
                is_array($decoded[$wrapper])
            ) {
                if (
                    $this->looksLikeQuestionList(
                        $decoded[$wrapper]
                    )
                ) {
                    return [
                        'questions' => array_values(
                            $decoded[$wrapper]
                        ),
                    ];
                }
            }
        }

        /*
         * Grouped difficulty output:
         *
         * {
         *   "easy": [...],
         *   "medium": [...],
         *   "hard": [...]
         * }
         */
        $groupedQuestions = [];

        foreach (
            ['easy', 'medium', 'hard']
            as $difficulty
        ) {
            if (
                isset($decoded[$difficulty]) &&
                is_array($decoded[$difficulty])
            ) {
                foreach (
                    $decoded[$difficulty]
                    as $question
                ) {
                    if (
                        is_array($question)
                    ) {
                        if (
                            !isset(
                                $question['difficulty']
                            )
                        ) {
                            $question['difficulty'] =
                                $difficulty;
                        }

                        $groupedQuestions[] =
                            $question;
                    }
                }
            }
        }

        if (!empty($groupedQuestions)) {
            return [
                'questions' => $groupedQuestions,
            ];
        }

        /*
         * If nothing matched, return the original
         * structure rather than silently destroying data.
         */
        return $decoded;
    }

    /**
     * Determine whether an array looks like a list
     * of generated questions.
     */
    protected function looksLikeQuestionList(
        array $items
    ): bool {
        if (empty($items)) {
            return false;
        }

        /*
         * Must be a sequential list.
         */
        if (
            array_keys($items) !==
            range(0, count($items) - 1)
        ) {
            return false;
        }

        $validCount = 0;

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            if (
                isset($item['question']) &&
                is_string($item['question']) &&
                trim($item['question']) !== ''
            ) {
                $validCount++;
                continue;
            }

            if (
                isset($item['question_text']) &&
                is_string($item['question_text']) &&
                trim($item['question_text']) !== ''
            ) {
                $validCount++;
                continue;
            }

            if (
                isset($item['text']) &&
                is_string($item['text']) &&
                trim($item['text']) !== ''
            ) {
                $validCount++;
                continue;
            }
        }

        return $validCount > 0;
    }

    /**
     * Determine whether an exception represents a
     * rate-limit condition.
     */
    protected function isRateLimitException(
        Throwable $e
    ): bool {
        $message = strtolower(
            $e->getMessage()
        );

        return str_contains(
            $message,
            'ai_model_rate_limited'
        )
            || str_contains(
                $message,
                '429'
            )
            || str_contains(
                $message,
                'rate limit'
            )
            || str_contains(
                $message,
                'rate-limited'
            )
            || str_contains(
                $message,
                'rate limited'
            )
            || str_contains(
                $message,
                'temporarily rate'
            )
            || str_contains(
                $message,
                'too many requests'
            );
    }

    /**
     * Determine whether an exception is safe to retry
     * on the SAME model.
     */
    protected function shouldRetry(
        Throwable $e
    ): bool {
        $message = strtolower(
            $e->getMessage()
        );

        /*
         * Never retry malformed AI output.
         */
        if (
            str_contains(
                $message,
                'invalid json'
            ) ||
            str_contains(
                $message,
                'invalid response'
            ) ||
            str_contains(
                $message,
                'empty content'
            ) ||
            str_contains(
                $message,
                'empty response'
            )
        ) {
            return false;
        }

        /*
         * Never retry authentication or client errors.
         */
        if (
            preg_match(
                '/http\s*(400|401|403|404)\b/i',
                $message
            )
        ) {
            return false;
        }

        /*
         * Retry network/transient errors.
         */
        if (
            str_contains(
                $message,
                'timeout'
            ) ||
            str_contains(
                $message,
                'timed out'
            ) ||
            str_contains(
                $message,
                'connection'
            ) ||
            str_contains(
                $message,
                'could not connect'
            ) ||
            str_contains(
                $message,
                'http 408'
            ) ||
            str_contains(
                $message,
                'http 500'
            ) ||
            str_contains(
                $message,
                'http 502'
            ) ||
            str_contains(
                $message,
                'http 503'
            ) ||
            str_contains(
                $message,
                'http 504'
            )
        ) {
            return true;
        }

        return false;
    }

    /**
     * Extract Retry-After from provider response.
     *
     * We intentionally DO NOT sleep based on this value
     * for 429. The requirement is immediate model failover.
     */
    protected function getRetryAfterSeconds(
        Response $response
    ): ?int {
        $header = $response->header(
            'Retry-After'
        );

        if (
            $header !== null &&
            is_numeric($header)
        ) {
            return max(
                0,
                (int) $header
            );
        }

        $json = $response->json();

        if (
            is_array($json) &&
            isset(
                $json['error']['metadata']['retry_after_seconds']
            )
        ) {
            $value =
                $json['error']['metadata'][
                    'retry_after_seconds'
                ];

            if (is_numeric($value)) {
                return max(
                    0,
                    (int) $value
                );
            }
        }

        return null;
    }

    /**
     * Build Gemini API URL.
     */
    protected function buildGeminiUrl(
        string $model
    ): string {
        /*
         * If GEMINI_API_URL already contains a model path,
         * use it as-is when it appears to be complete.
         */
        if (
            str_contains(
                $this->url,
                '{model}'
            )
        ) {
            return str_replace(
                '{model}',
                rawurlencode($model),
                $this->url
            );
        }

        /*
         * If the configured URL already contains
         * /models/<model>/..., don't append another model.
         */
        if (
            preg_match(
                '#/models/[^/]+:generateContent#',
                $this->url
            )
        ) {
            return $this->url;
        }

        /*
         * Standard Gemini base URL.
         */
        $base = rtrim(
            $this->url,
            '/'
        );

        /*
         * If URL ends with /models, append model.
         */
        if (
            str_ends_with(
                $base,
                '/models'
            )
        ) {
            return $base .
                '/' .
                rawurlencode($model) .
                ':generateContent';
        }

        /*
         * Otherwise assume configured URL is a base
         * endpoint and append /models/<model>.
         */
        return $base .
            '/models/' .
            rawurlencode($model) .
            ':generateContent';
    }

    /**
     * Determine whether temporary provider is OpenRouter.
     */
    protected function isUsingOpenRouter(): bool
    {
        return str_contains(
            strtolower($this->url),
            'openrouter.ai'
        );
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getModels(): array
    {
        return $this->models;
    }

    public function getProvider(): string
    {
        return $this->useTempProvider
            ? 'openrouter'
            : 'gemini';
    }
}