<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\LessonAssignment;
use App\Models\Question;
use App\Models\Topic;
use App\Services\GroqService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use RuntimeException;
use Smalot\PdfParser\Parser;
use Throwable;

class AiLessonController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | CONFIGURATION
    |--------------------------------------------------------------------------
    */

    private const PDF_MAX_CHARS = 60000;

    /*
     * Keep AI batches small.
     * This is intentionally 10 because the frontend requests
     * 10 easy + 10 medium + 10 hard by default.
     */
    private const MAX_BATCH_SIZE = 10;

    /*
     * Retry malformed/invalid AI output once.
     *
     * Rate limits are NOT retried here.
     * GroqService handles provider/model-level retry/fallback.
     */
    private const MAX_GENERATION_ATTEMPTS = 2;

    /*
     * Small delay between controller retries.
     */
    private const GENERATION_RETRY_DELAY_MS = 1200;

    /*
    |--------------------------------------------------------------------------
    | STAGE 1
    | PDF -> Lesson + Topics + Assignment
    |--------------------------------------------------------------------------
    */

    public function generateLesson(
        Request $request,
        GroqService $groq
    ) {
        Log::info('AI LESSON STAGE 1: START', [
            'file' => $request->file('file')?->getClientOriginalName(),
            'user_id' => $request->input('user_id'),
            'easy_questions' => $request->input('easy_questions'),
            'medium_questions' => $request->input('medium_questions'),
            'hard_questions' => $request->input('hard_questions'),
            'model' => $groq->getModel(),
            'provider' => $groq->getProvider(),
        ]);

        $validator = Validator::make(
            $request->all(),
            [
                'file' => [
                    'required',
                    'file',
                    'max:20480',
                    'mimes:pdf',
                ],

                'lesson_title' => [
                    'nullable',
                    'string',
                    'max:150',
                ],

                'easy_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],

                'medium_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],

                'hard_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],

                'user_id' => [
                    'required',
                    'integer',
                    'exists:users,id',
                ],
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $easy = (int) $validated['easy_questions'];
        $medium = (int) $validated['medium_questions'];
        $hard = (int) $validated['hard_questions'];

        $total = $easy + $medium + $hard;

        try {
            /*
            |--------------------------------------------------------------------------
            | Validate PDF
            |--------------------------------------------------------------------------
            */

            $file = $request->file('file');

            if (!$file || !$file->isValid()) {
                throw new RuntimeException(
                    'The uploaded PDF is invalid or could not be read.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Extract PDF
            |--------------------------------------------------------------------------
            */

            $parser = new Parser();

            $pdf = $parser->parseFile(
                $file->getRealPath()
            );

            $content = $pdf->getText();

            if (!is_string($content)) {
                throw new RuntimeException(
                    'Unable to extract readable text from the PDF.'
                );
            }

            $content = preg_replace(
                '/\s+/u',
                ' ',
                $content
            );

            $content = trim($content);

            if ($content === '') {
                throw new RuntimeException(
                    'No readable text was found in the uploaded PDF.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Limit PDF context
            |--------------------------------------------------------------------------
            */

            $originalCharCount = mb_strlen($content);

            if ($originalCharCount > self::PDF_MAX_CHARS) {
                $content = mb_substr(
                    $content,
                    0,
                    self::PDF_MAX_CHARS
                );

                Log::info(
                    'PDF CONTENT TRUNCATED BEFORE AI GENERATION',
                    [
                        'original_chars' => $originalCharCount,
                        'sent_chars' => mb_strlen($content),
                        'max_chars' => self::PDF_MAX_CHARS,
                    ]
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Lesson title
            |--------------------------------------------------------------------------
            */

            $requestedTitle = trim(
                $validated['lesson_title'] ?? ''
            );

            $lessonTitle =
                $requestedTitle !== ''
                    ? $requestedTitle
                    : 'AI Generated Lesson';

            /*
            |--------------------------------------------------------------------------
            | Generate lesson + topics
            |--------------------------------------------------------------------------
            */

            $prompt = <<<PROMPT
You are an expert educational curriculum designer.

Analyze the learning material below.

Create ONE educational lesson containing:

- a concise lesson title
- a clear lesson description
- 3 to 8 meaningful topics

Do NOT generate questions.

Return ONLY valid JSON.

Required JSON structure:

{
    "title": "string",
    "description": "string",
    "topics": [
        {
            "name": "string",
            "description": "string"
        }
    ]
}

STRICT RULES:

- Generate between 3 and 8 topics.
- Every topic must directly relate to the material.
- Do not invent unrelated topics.
- Topic names must be concise.
- Topic descriptions must be concise.
- Lesson description must be concise.
- Do not duplicate topics.
- Do not use markdown.
- Do not include extra JSON fields.
- Do not include text outside JSON.
- Return complete valid JSON.
- Properly close every JSON object and array.

Requested lesson title:

{$lessonTitle}

Learning material:

{$content}
PROMPT;

            $startTime = microtime(true);

            $result = $groq->generateJson($prompt);

            $durationMs = (int) round(
                (
                    microtime(true) -
                    $startTime
                ) * 1000
            );

            Log::info(
                'AI LESSON STAGE 1: AI SUCCESS',
                [
                    'duration_ms' => $durationMs,
                    'model' => $groq->getModel(),
                    'provider' => $groq->getProvider(),
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Validate AI result
            |--------------------------------------------------------------------------
            */

            $generatedTitle = trim(
                (string) (
                    $result['title']
                    ?? $lessonTitle
                )
            );

            $description = trim(
                (string) (
                    $result['description']
                    ?? ''
                )
            );

            $topics = $result['topics'] ?? null;

            if ($generatedTitle === '') {
                throw new RuntimeException(
                    'Generated lesson title is empty.'
                );
            }

            if ($description === '') {
                throw new RuntimeException(
                    'Generated lesson description is empty.'
                );
            }

            if (!is_array($topics)) {
                throw new RuntimeException(
                    'Generated topics are invalid.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Clean topics
            |--------------------------------------------------------------------------
            */

            $cleanTopics = [];
            $seenTopicNames = [];

            foreach ($topics as $topicData) {
                if (!is_array($topicData)) {
                    continue;
                }

                $topicName = trim(
                    (string) (
                        $topicData['name']
                        ?? ''
                    )
                );

                $topicDescription = trim(
                    (string) (
                        $topicData['description']
                        ?? ''
                    )
                );

                if ($topicName === '') {
                    continue;
                }

                $topicKey = strtolower(
                    preg_replace(
                        '/\s+/u',
                        ' ',
                        $topicName
                    )
                );

                if (isset($seenTopicNames[$topicKey])) {
                    continue;
                }

                $seenTopicNames[$topicKey] = true;

                $cleanTopics[] = [
                    'name' => mb_substr(
                        $topicName,
                        0,
                        150
                    ),

                    'description' => mb_substr(
                        $topicDescription,
                        0,
                        1000
                    ),
                ];
            }

            if (
                count($cleanTopics) < 3 ||
                count($cleanTopics) > 8
            ) {
                throw new RuntimeException(
                    'AI must generate between 3 and 8 valid topics. ' .
                    'Generated: ' .
                    count($cleanTopics)
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Save atomically
            |--------------------------------------------------------------------------
            */

            $userId = (int) $validated['user_id'];

            $lesson = DB::transaction(
                function () use (
                    $generatedTitle,
                    $description,
                    $cleanTopics,
                    $userId
                ) {
                    $lesson = Lesson::create([
                        'title' => $generatedTitle,
                        'description' => $description,
                    ]);

                    foreach (
                        $cleanTopics
                        as $index => $topicData
                    ) {
                        Topic::create([
                            'lesson_id' => $lesson->id,
                            'name' => $topicData['name'],
                            'description' => $topicData['description'],
                            'topic_order' => $index + 1,
                        ]);
                    }

                    LessonAssignment::firstOrCreate(
                        [
                            'user_id' => $userId,
                            'lesson_id' => $lesson->id,
                        ],
                        [
                            'assigned_at' => now(),
                        ]
                    );

                    return $lesson;
                }
            );

            $lesson->load('topics');

            Log::info(
                'AI LESSON STAGE 1 SUCCESS',
                [
                    'lesson_id' => $lesson->id,
                    'user_id' => $userId,
                    'topic_count' => $lesson->topics->count(),
                    'easy_questions' => $easy,
                    'medium_questions' => $medium,
                    'hard_questions' => $hard,
                    'total_questions_per_topic' => $total,
                    'batch_size' => self::MAX_BATCH_SIZE,
                ]
            );

            return response()->json([
                'success' => true,
                'stage' => 'lesson_topics',
                'message' =>
                    'Lesson and topics generated successfully.',
                'data' => $lesson,
                'assignment' => [
                    'user_id' => $userId,
                    'lesson_id' => $lesson->id,
                    'assigned_at' => now(),
                ],
                'configuration' => [
                    'easy_questions' => $easy,
                    'medium_questions' => $medium,
                    'hard_questions' => $hard,
                    'total_questions_per_topic' => $total,
                    'batch_size' => self::MAX_BATCH_SIZE,
                ],
            ]);
        } catch (Throwable $e) {
            Log::error(
                'AI LESSON STAGE 1 FAILED',
                [
                    'message' => $e->getMessage(),
                    'file' =>
                        $request
                            ->file('file')
                            ?->getClientOriginalName(),
                    'user_id' => $request->input('user_id'),
                    'exception' => get_class($e),
                    'model' => $groq->getModel(),
                    'provider' => $groq->getProvider(),
                ]
            );

            $message = strtolower(
                $e->getMessage()
            );

            $isRateLimited =
                str_contains($message, 'rate limit') ||
                str_contains($message, '429') ||
                str_contains($message, 'too many requests');

            return response()->json([
                'success' => false,
                'stage' => 'lesson_topics',
                'message' =>
                    $isRateLimited
                        ? 'The AI provider rate limit was reached. Please wait and try again.'
                        : 'Failed to generate lesson and topics.',
                'error' => $e->getMessage(),
                'rate_limited' => $isRateLimited,
                'resumable' => false,
            ], $isRateLimited ? 429 : 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | STAGE 2
    | Topic -> Questions
    |--------------------------------------------------------------------------
    */

    public function generateTopicQuestions(
        Request $request,
        GroqService $groq
    ) {
        Log::info(
            'AI LESSON STAGE 2: START',
            [
                'topic_id' => $request->input('topic_id'),
                'easy_questions' => $request->input('easy_questions'),
                'medium_questions' => $request->input('medium_questions'),
                'hard_questions' => $request->input('hard_questions'),
                'batch_size' => self::MAX_BATCH_SIZE,
                'model' => $groq->getModel(),
                'provider' => $groq->getProvider(),
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | 1. Validation
        |--------------------------------------------------------------------------
        */

        $validator = Validator::make(
            $request->all(),
            [
                'topic_id' => [
                    'required',
                    'integer',
                    'exists:topics,id',
                ],

                'easy_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],

                'medium_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],

                'hard_questions' => [
                    'required',
                    'integer',
                    'min:0',
                    'max:100',
                ],
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $topicId = (int) $validated['topic_id'];

        $targets = [
            'easy' => (int) $validated['easy_questions'],
            'medium' => (int) $validated['medium_questions'],
            'hard' => (int) $validated['hard_questions'],
        ];

        $totalRequested = array_sum($targets);

        if ($totalRequested === 0) {
            return response()->json([
                'success' => true,
                'stage' => 'topic_questions',
                'message' =>
                    'No questions were requested for this topic.',
                'topic_id' => $topicId,
                'configuration' => [
                    'easy_questions' => 0,
                    'medium_questions' => 0,
                    'hard_questions' => 0,
                    'total_questions' => 0,
                    'batch_size' => self::MAX_BATCH_SIZE,
                ],
            ]);
        }

        try {
            /*
            |--------------------------------------------------------------------------
            | 2. Load topic
            |--------------------------------------------------------------------------
            */

            $topic = Topic::with('lesson')
                ->findOrFail($topicId);

            $lesson = $topic->lesson;

            if (!$lesson) {
                throw new RuntimeException(
                    'The topic does not have a valid lesson.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 3. Normalizer
            |--------------------------------------------------------------------------
            */

            $normalize = static function (
                string $value
            ): string {
                $value = trim(
                    mb_strtolower($value)
                );

                $value = preg_replace(
                    '/\s+/u',
                    ' ',
                    $value
                );

                $value = preg_replace(
                    '/[[:punct:]]+/u',
                    ' ',
                    $value
                );

                return trim($value);
            };

            /*
            |--------------------------------------------------------------------------
            | 4. ALWAYS read actual database state
            |--------------------------------------------------------------------------
            */

            $getCounts = function () use (
                $topic
            ): array {
                $counts = [
                    'easy' => 0,
                    'medium' => 0,
                    'hard' => 0,
                ];

                $rows = $topic
                    ->questions()
                    ->selectRaw(
                        'LOWER(TRIM(difficulty)) as difficulty, COUNT(*) as aggregate'
                    )
                    ->groupByRaw(
                        'LOWER(TRIM(difficulty))'
                    )
                    ->get();

                foreach ($rows as $row) {
                    $difficulty = strtolower(
                        trim(
                            (string) $row->difficulty
                        )
                    );

                    if (
                        array_key_exists(
                            $difficulty,
                            $counts
                        )
                    ) {
                        $counts[$difficulty] =
                            (int) $row->aggregate;
                    }
                }

                return $counts;
            };

            $calculateRemaining = static function (
                array $targets,
                array $counts
            ): array {
                return [
                    'easy' => max(
                        0,
                        $targets['easy'] -
                        $counts['easy']
                    ),

                    'medium' => max(
                        0,
                        $targets['medium'] -
                        $counts['medium']
                    ),

                    'hard' => max(
                        0,
                        $targets['hard'] -
                        $counts['hard']
                    ),
                ];
            };

            /*
            |--------------------------------------------------------------------------
            | 5. Initial state
            |--------------------------------------------------------------------------
            */

            $initialCounts = $getCounts();

            $initialRemaining = $calculateRemaining(
                $targets,
                $initialCounts
            );

            Log::info(
                'AI LESSON STAGE 2: INITIAL DATABASE STATE',
                [
                    'topic_id' => $topicId,
                    'existing_counts' => $initialCounts,
                    'targets' => $targets,
                    'remaining' => $initialRemaining,
                    'total_current' => array_sum($initialCounts),
                    'total_target' => $totalRequested,
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Already complete
            |--------------------------------------------------------------------------
            */

            if (
                array_sum($initialRemaining) === 0
            ) {
                return $this->topicGenerationResponse(
                    $topic,
                    $targets,
                    $initialCounts,
                    $initialCounts,
                    [
                        'easy' => 0,
                        'medium' => 0,
                        'hard' => 0,
                    ],
                    true
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 6. Existing question cache
            |--------------------------------------------------------------------------
            */

            $existingQuestionKeys = [];

            $existingQuestionTexts =
                $topic
                    ->questions()
                    ->select('question')
                    ->pluck('question');

            foreach ($existingQuestionTexts as $questionText) {
                $key = $normalize(
                    (string) $questionText
                );

                if ($key !== '') {
                    $existingQuestionKeys[$key] = true;
                }
            }

            /*
            |--------------------------------------------------------------------------
            | 7. Generation tracker
            |--------------------------------------------------------------------------
            */

            $generatedNow = [
                'easy' => 0,
                'medium' => 0,
                'hard' => 0,
            ];

            /*
            |--------------------------------------------------------------------------
            | 8. Difficulty order
            |--------------------------------------------------------------------------
            */

            $difficulties = [
                'easy',
                'medium',
                'hard',
            ];

            /*
            |--------------------------------------------------------------------------
            | 9. Generate difficulty by difficulty
            |--------------------------------------------------------------------------
            */

            foreach (
                $difficulties
                as $difficulty
            ) {
                while (true) {
                    /*
                    |--------------------------------------------------------------------------
                    | ALWAYS recalculate from DB
                    |--------------------------------------------------------------------------
                    */

                    $currentCounts =
                        $getCounts();

                    $remaining =
                        $calculateRemaining(
                            $targets,
                            $currentCounts
                        );

                    $remainingForDifficulty =
                        $remaining[$difficulty];

                    if ($remainingForDifficulty <= 0) {
                        break;
                    }

                    $batchSize = min(
                        self::MAX_BATCH_SIZE,
                        $remainingForDifficulty
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Question prompt
                    |--------------------------------------------------------------------------
                    */

                    $prompt = <<<PROMPT
You are an expert educational assessment writer.

Generate exactly {$batchSize} NEW multiple-choice questions.

LESSON:
{$lesson->title}

LESSON DESCRIPTION:
{$lesson->description}

TOPIC:
{$topic->name}

TOPIC DESCRIPTION:
{$topic->description}

REQUIRED DIFFICULTY:
{$difficulty}

NUMBER OF QUESTIONS:
{$batchSize}

RULES:

- Every question must directly test the specified topic.
- Every question must be educationally meaningful.
- Questions must be clear and unambiguous.
- Do not create trick questions.
- Do not depend on information outside the lesson/topic.
- Avoid repetitive question patterns.
- Every question must have exactly four choices.
- All four choices must be different.
- Only one choice may be correct.
- The correct answer must be A, B, C, or D.
- Include a concise explanation.
- Every question must be {$difficulty}.
- Every question must have exactly 1 point.
- Do not generate another difficulty.
- Do not duplicate questions.
- Do not duplicate question wording.
- Do not use markdown.
- Do not add commentary.
- Do not add text outside JSON.
- Do not add extra JSON fields.

IMPORTANT:

Return ONLY valid JSON.

Return this exact structure:

{
    "questions": [
        {
            "question": "string",
            "choice_a": "string",
            "choice_b": "string",
            "choice_c": "string",
            "choice_d": "string",
            "correct_answer": "A",
            "explanation": "string",
            "difficulty": "{$difficulty}",
            "points": 1
        }
    ]
}

Return exactly {$batchSize} questions whenever possible.
PROMPT;

                    /*
                    |--------------------------------------------------------------------------
                    | 10. AI generation
                    |--------------------------------------------------------------------------
                    */

                    $validQuestions = [];

                    for (
                        $attempt = 1;
                        $attempt <= self::MAX_GENERATION_ATTEMPTS;
                        $attempt++
                    ) {
                        try {
                            Log::info(
                                'AI QUESTION BATCH START',
                                [
                                    'topic_id' => $topicId,
                                    'difficulty' => $difficulty,
                                    'requested_batch_size' => $batchSize,
                                    'remaining_before_batch' =>
                                        $remainingForDifficulty,
                                    'attempt' => $attempt,
                                    'model' => $groq->getModel(),
                                    'provider' => $groq->getProvider(),
                                ]
                            );

                            $startTime =
                                microtime(true);

                            $result =
                                $groq->generateJson(
                                    $prompt
                                );

                            $durationMs =
                                (int) round(
                                    (
                                        microtime(true) -
                                        $startTime
                                    ) * 1000
                                );

                            Log::info(
                                'AI QUESTION BATCH AI RESPONSE',
                                [
                                    'topic_id' => $topicId,
                                    'difficulty' => $difficulty,
                                    'requested_batch_size' => $batchSize,
                                    'duration_ms' => $durationMs,
                                    'model' => $groq->getModel(),
                                    'provider' => $groq->getProvider(),
                                ]
                            );

                            $questions =
                                $result['questions']
                                ?? null;

                            if (!is_array($questions)) {
                                throw new RuntimeException(
                                    'Generated questions field is invalid.'
                                );
                            }

                            $validQuestions = [];
                            $batchKeys = [];

                            foreach (
                                $questions
                                as $question
                            ) {
                                if (!is_array($question)) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Question text
                                |--------------------------------------------------------------------------
                                */

                                $questionText =
                                    trim(
                                        (string) (
                                            $question['question']
                                            ?? ''
                                        )
                                    );

                                if ($questionText === '') {
                                    continue;
                                }

                                $questionKey =
                                    $normalize(
                                        $questionText
                                    );

                                if ($questionKey === '') {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Existing DB duplicate
                                |--------------------------------------------------------------------------
                                */

                                if (
                                    isset(
                                        $existingQuestionKeys[
                                            $questionKey
                                        ]
                                    )
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Current batch duplicate
                                |--------------------------------------------------------------------------
                                */

                                if (
                                    isset(
                                        $batchKeys[
                                            $questionKey
                                        ]
                                    )
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Difficulty
                                |--------------------------------------------------------------------------
                                |
                                | Since this entire AI request is for one difficulty,
                                | the requested difficulty is authoritative.
                                |
                                | If AI omits the difficulty field, accept it as
                                | the requested difficulty.
                                |--------------------------------------------------------------------------
                                */

                                $questionDifficulty =
                                    strtolower(
                                        trim(
                                            (string) (
                                                $question['difficulty']
                                                ?? ''
                                            )
                                        )
                                    );

                                if (
                                    $questionDifficulty === ''
                                ) {
                                    $questionDifficulty =
                                        $difficulty;
                                }

                                if (
                                    $questionDifficulty !==
                                    $difficulty
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Choices
                                |--------------------------------------------------------------------------
                                */

                                $choiceA =
                                    trim(
                                        (string) (
                                            $question['choice_a']
                                            ?? ''
                                        )
                                    );

                                $choiceB =
                                    trim(
                                        (string) (
                                            $question['choice_b']
                                            ?? ''
                                        )
                                    );

                                $choiceC =
                                    trim(
                                        (string) (
                                            $question['choice_c']
                                            ?? ''
                                        )
                                    );

                                $choiceD =
                                    trim(
                                        (string) (
                                            $question['choice_d']
                                            ?? ''
                                        )
                                    );

                                if (
                                    $choiceA === '' ||
                                    $choiceB === '' ||
                                    $choiceC === '' ||
                                    $choiceD === ''
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Unique choices
                                |--------------------------------------------------------------------------
                                */

                                $choiceKeys =
                                    array_map(
                                        $normalize,
                                        [
                                            $choiceA,
                                            $choiceB,
                                            $choiceC,
                                            $choiceD,
                                        ]
                                    );

                                if (
                                    count(
                                        array_unique(
                                            $choiceKeys
                                        )
                                    ) !== 4
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Correct answer
                                |--------------------------------------------------------------------------
                                */

                                $correctAnswer =
                                    strtoupper(
                                        trim(
                                            (string) (
                                                $question[
                                                    'correct_answer'
                                                ]
                                                ?? ''
                                            )
                                        )
                                    );

                                if (
                                    !in_array(
                                        $correctAnswer,
                                        [
                                            'A',
                                            'B',
                                            'C',
                                            'D',
                                        ],
                                        true
                                    )
                                ) {
                                    continue;
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Explanation
                                |--------------------------------------------------------------------------
                                */

                                $explanation =
                                    trim(
                                        (string) (
                                            $question[
                                                'explanation'
                                            ]
                                            ?? ''
                                        )
                                    );

                                /*
                                |--------------------------------------------------------------------------
                                | Valid question
                                |--------------------------------------------------------------------------
                                */

                                $validQuestions[] = [
                                    'question' =>
                                        $questionText,

                                    'choice_a' =>
                                        $choiceA,

                                    'choice_b' =>
                                        $choiceB,

                                    'choice_c' =>
                                        $choiceC,

                                    'choice_d' =>
                                        $choiceD,

                                    'correct_answer' =>
                                        $correctAnswer,

                                    'explanation' =>
                                        $explanation !== ''
                                            ? $explanation
                                            : null,

                                    'difficulty' =>
                                        $difficulty,

                                    'points' =>
                                        1,
                                ];

                                $batchKeys[
                                    $questionKey
                                ] = true;

                                if (
                                    count(
                                        $validQuestions
                                    ) >=
                                    $batchSize
                                ) {
                                    break;
                                }
                            }

                            $validCount =
                                count(
                                    $validQuestions
                                );

                            Log::info(
                                'AI QUESTION BATCH VALIDATION RESULT',
                                [
                                    'topic_id' => $topicId,
                                    'difficulty' => $difficulty,
                                    'requested' => $batchSize,
                                    'valid_questions' => $validCount,
                                    'attempt' => $attempt,
                                ]
                            );

                            if ($validCount > 0) {
                                break;
                            }

                            throw new RuntimeException(
                                "AI returned 0 valid {$difficulty} questions."
                            );
                        } catch (Throwable $e) {
                            $errorMessage =
                                strtolower(
                                    $e->getMessage()
                                );

                            $isRateLimited =
                                str_contains(
                                    $errorMessage,
                                    'rate limit'
                                ) ||
                                str_contains(
                                    $errorMessage,
                                    '429'
                                ) ||
                                str_contains(
                                    $errorMessage,
                                    'too many requests'
                                );

                            Log::warning(
                                'AI QUESTION BATCH FAILED',
                                [
                                    'topic_id' => $topicId,
                                    'difficulty' => $difficulty,
                                    'requested_batch_size' => $batchSize,
                                    'attempt' => $attempt,
                                    'rate_limited' => $isRateLimited,
                                    'message' => $e->getMessage(),
                                ]
                            );

                            /*
                            |--------------------------------------------------------------------------
                            | NEVER retry rate limits here.
                            |--------------------------------------------------------------------------
                            */

                            if ($isRateLimited) {
                                throw $e;
                            }

                            /*
                            |--------------------------------------------------------------------------
                            | Retry malformed/invalid output once.
                            |--------------------------------------------------------------------------
                            */

                            if (
                                $attempt <
                                self::MAX_GENERATION_ATTEMPTS
                            ) {
                                usleep(
                                    self::GENERATION_RETRY_DELAY_MS *
                                    1000
                                );

                                continue;
                            }

                            throw $e;
                        }
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | 11. Save valid questions
                    |--------------------------------------------------------------------------
                    */

                    if (empty($validQuestions)) {
                        throw new RuntimeException(
                            "No valid {$difficulty} questions were generated."
                        );
                    }

                    $savedCount =
                        DB::transaction(
                            function () use (
                                $topic,
                                $validQuestions,
                                &$existingQuestionKeys,
                                $normalize
                            ) {
                                $savedCount = 0;

                                foreach (
                                    $validQuestions
                                    as $question
                                ) {
                                    $questionKey =
                                        $normalize(
                                            $question['question']
                                        );

                                    if (
                                        isset(
                                            $existingQuestionKeys[
                                                $questionKey
                                            ]
                                        )
                                    ) {
                                        continue;
                                    }

                                    /*
                                    |--------------------------------------------------------------------------
                                    | Final duplicate protection
                                    |--------------------------------------------------------------------------
                                    */

                                    $alreadyExists =
                                        $topic
                                            ->questions()
                                            ->where(
                                                'question',
                                                $question['question']
                                            )
                                            ->exists();

                                    if ($alreadyExists) {
                                        $existingQuestionKeys[
                                            $questionKey
                                        ] = true;

                                        continue;
                                    }

                                    $topic
                                        ->questions()
                                        ->create([
                                            'question' =>
                                                $question['question'],

                                            'choice_a' =>
                                                $question['choice_a'],

                                            'choice_b' =>
                                                $question['choice_b'],

                                            'choice_c' =>
                                                $question['choice_c'],

                                            'choice_d' =>
                                                $question['choice_d'],

                                            'correct_answer' =>
                                                $question['correct_answer'],

                                            'explanation' =>
                                                $question['explanation'],

                                            'difficulty' =>
                                                $question['difficulty'],

                                            'points' =>
                                                1,
                                        ]);

                                    $existingQuestionKeys[
                                        $questionKey
                                    ] = true;

                                    $savedCount++;
                                }

                                return $savedCount;
                            }
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | 12. Prevent infinite loop
                    |--------------------------------------------------------------------------
                    */

                    if ($savedCount <= 0) {
                        throw new RuntimeException(
                            "The AI generated {$difficulty} questions, but none could be saved because they were duplicates."
                        );
                    }

                    $generatedNow[$difficulty] +=
                        $savedCount;

                    /*
                    |--------------------------------------------------------------------------
                    | 13. Recalculate DB progress
                    |--------------------------------------------------------------------------
                    */

                    $currentCounts =
                        $getCounts();

                    $remaining =
                        $calculateRemaining(
                            $targets,
                            $currentCounts
                        );

                    $remainingForDifficulty =
                        $remaining[$difficulty];

                    Log::info(
                        'AI QUESTION BATCH SAVED',
                        [
                            'topic_id' => $topicId,
                            'difficulty' => $difficulty,
                            'requested_batch_size' => $batchSize,
                            'saved_count' => $savedCount,
                            'current_count' =>
                                $currentCounts[$difficulty],
                            'target' =>
                                $targets[$difficulty],
                            'remaining' =>
                                $remainingForDifficulty,
                            'generated_now' =>
                                $generatedNow,
                            'total_current' =>
                                array_sum($currentCounts),
                            'total_target' =>
                                $totalRequested,
                        ]
                    );
                }
            }

            /*
            |--------------------------------------------------------------------------
            | 14. Final DB state
            |--------------------------------------------------------------------------
            */

            $finalCounts =
                $getCounts();

            $finalRemaining =
                $calculateRemaining(
                    $targets,
                    $finalCounts
                );

            /*
            |--------------------------------------------------------------------------
            | 15. Incomplete
            |--------------------------------------------------------------------------
            */

            if (
                array_sum($finalRemaining) > 0
            ) {
                Log::warning(
                    'AI QUESTION GENERATION INCOMPLETE',
                    [
                        'topic_id' => $topicId,
                        'targets' => $targets,
                        'final_counts' => $finalCounts,
                        'remaining' => $finalRemaining,
                        'generated_now' => $generatedNow,
                    ]
                );

                return $this->topicGenerationResponse(
                    $topic,
                    $targets,
                    $initialCounts,
                    $finalCounts,
                    $generatedNow,
                    false,
                    'Some questions were generated successfully, but the requested total was not reached. Retry this topic to generate only the remaining questions.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 16. Complete
            |--------------------------------------------------------------------------
            */

            $wasResumed =
                array_sum($initialCounts) > 0;

            Log::info(
                'AI LESSON STAGE 2 SUCCESS',
                [
                    'topic_id' => $topicId,
                    'easy' => $finalCounts['easy'],
                    'medium' => $finalCounts['medium'],
                    'hard' => $finalCounts['hard'],
                    'total' => array_sum($finalCounts),
                    'target_total' => $totalRequested,
                    'generated_now' => $generatedNow,
                    'resumed' => $wasResumed,
                ]
            );

            return $this->topicGenerationResponse(
                $topic,
                $targets,
                $initialCounts,
                $finalCounts,
                $generatedNow,
                true
            );
        } catch (Throwable $e) {
            /*
            |--------------------------------------------------------------------------
            | 17. Error handling
            |--------------------------------------------------------------------------
            |
            | IMPORTANT:
            | Even when AI fails, query the database AGAIN.
            |
            | This guarantees that the frontend receives the actual
            | persisted question count instead of 0/target.
            |--------------------------------------------------------------------------
            */

            $errorCounts = [
                'easy' => 0,
                'medium' => 0,
                'hard' => 0,
            ];

            try {
                $errorTopic =
                    Topic::query()
                        ->find($topicId);

                if ($errorTopic) {
                    $rows =
                        $errorTopic
                            ->questions()
                            ->selectRaw(
                                'LOWER(TRIM(difficulty)) as difficulty, COUNT(*) as aggregate'
                            )
                            ->groupByRaw(
                                'LOWER(TRIM(difficulty))'
                            )
                            ->get();

                    foreach ($rows as $row) {
                        $difficulty =
                            strtolower(
                                trim(
                                    (string) $row->difficulty
                                )
                            );

                        if (
                            array_key_exists(
                                $difficulty,
                                $errorCounts
                            )
                        ) {
                            $errorCounts[$difficulty] =
                                (int) $row->aggregate;
                        }
                    }
                }
            } catch (Throwable $countException) {
                Log::warning(
                    'Could not read DB question progress after failure',
                    [
                        'topic_id' => $topicId,
                        'error' =>
                            $countException->getMessage(),
                    ]
                );
            }

            $errorRemaining = [
                'easy' => max(
                    0,
                    $targets['easy'] -
                    $errorCounts['easy']
                ),

                'medium' => max(
                    0,
                    $targets['medium'] -
                    $errorCounts['medium']
                ),

                'hard' => max(
                    0,
                    $targets['hard'] -
                    $errorCounts['hard']
                ),
            ];

            $errorTotalCurrent =
                array_sum(
                    $errorCounts
                );

            $errorTotalRemaining =
                array_sum(
                    $errorRemaining
                );

            $message =
                strtolower(
                    $e->getMessage()
                );

            $isRateLimited =
                str_contains(
                    $message,
                    'rate limit'
                ) ||
                str_contains(
                    $message,
                    '429'
                ) ||
                str_contains(
                    $message,
                    'too many requests'
                );

            Log::error(
                'AI LESSON STAGE 2 FAILED',
                [
                    'topic_id' => $topicId,
                    'message' => $e->getMessage(),
                    'exception' => get_class($e),
                    'model' => $groq->getModel(),
                    'provider' => $groq->getProvider(),
                    'database_counts' => $errorCounts,
                    'targets' => $targets,
                    'remaining' => $errorRemaining,
                    'total_current' =>
                        $errorTotalCurrent,
                    'total_remaining' =>
                        $errorTotalRemaining,
                ]
            );

            return response()->json([
                'success' => false,

                'stage' =>
                    'topic_questions',

                'message' =>
                    $isRateLimited
                        ? 'The AI provider rate limit was reached. Successfully saved questions were preserved. Retry this topic later to continue.'
                        : 'Question generation paused. Successfully saved questions were preserved. Retry this topic to continue.',

                'error' =>
                    $e->getMessage(),

                'rate_limited' =>
                    $isRateLimited,

                'resumable' =>
                    true,

                'topic_id' =>
                    $topicId,

                'topic_name' =>
                    isset($topic)
                        ? $topic->name
                        : null,

                /*
                |--------------------------------------------------------------------------
                | REAL DATABASE PROGRESS
                |--------------------------------------------------------------------------
                */

                'progress' => [
                    'easy' => [
                        'current' =>
                            $errorCounts['easy'],

                        'target' =>
                            $targets['easy'],

                        'remaining' =>
                            $errorRemaining['easy'],
                    ],

                    'medium' => [
                        'current' =>
                            $errorCounts['medium'],

                        'target' =>
                            $targets['medium'],

                        'remaining' =>
                            $errorRemaining['medium'],
                    ],

                    'hard' => [
                        'current' =>
                            $errorCounts['hard'],

                        'target' =>
                            $targets['hard'],

                        'remaining' =>
                            $errorRemaining['hard'],
                    ],

                    'total_current' =>
                        $errorTotalCurrent,

                    'total_target' =>
                        $totalRequested,

                    'total_remaining' =>
                        $errorTotalRemaining,

                    'percentage' =>
                        $totalRequested > 0
                            ? round(
                                (
                                    $errorTotalCurrent /
                                    $totalRequested
                                ) * 100,
                                2
                            )
                            : 100,
                ],

                /*
                |--------------------------------------------------------------------------
                | Easy frontend fallback
                |--------------------------------------------------------------------------
                */

                'current_counts' =>
                    $errorCounts,

                'remaining' =>
                    $errorRemaining,

                'configuration' => [
                    'easy_questions' =>
                        $targets['easy'],

                    'medium_questions' =>
                        $targets['medium'],

                    'hard_questions' =>
                        $targets['hard'],

                    'total_questions' =>
                        $totalRequested,

                    'batch_size' =>
                        self::MAX_BATCH_SIZE,

                    'final_easy' =>
                        $errorCounts['easy'],

                    'final_medium' =>
                        $errorCounts['medium'],

                    'final_hard' =>
                        $errorCounts['hard'],
                ],

                'generated_now' =>
                    $generatedNow ?? [
                        'easy' => 0,
                        'medium' => 0,
                        'hard' => 0,
                    ],
            ], $isRateLimited ? 429 : 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | RESPONSE HELPER
    |--------------------------------------------------------------------------
    */

    private function topicGenerationResponse(
        Topic $topic,
        array $targets,
        array $existingCounts,
        array $finalCounts,
        array $generatedNow,
        bool $success,
        ?string $error = null
    ) {
        $totalRequested =
            array_sum($targets);

        $totalCurrent =
            array_sum($finalCounts);

        $remaining = [
            'easy' => max(
                0,
                $targets['easy'] -
                $finalCounts['easy']
            ),

            'medium' => max(
                0,
                $targets['medium'] -
                $finalCounts['medium']
            ),

            'hard' => max(
                0,
                $targets['hard'] -
                $finalCounts['hard']
            ),
        ];

        $complete =
            array_sum($remaining) === 0;

        /*
        |--------------------------------------------------------------------------
        | Only return questions when complete.
        |--------------------------------------------------------------------------
        */

        $questions = [];

        if ($success && $complete) {
            $questions =
                $topic
                    ->questions()
                    ->orderBy('id')
                    ->get();
        }

        $response = [
            'success' =>
                $success &&
                $complete,

            'stage' =>
                'topic_questions',

            'message' =>
                (
                    $success &&
                    $complete
                )
                    ? (
                        array_sum($existingCounts) > 0
                            ? 'Topic questions successfully resumed and completed.'
                            : 'Topic questions generated successfully.'
                    )
                    : 'Question generation was paused. Successfully generated questions were preserved. Retry this topic to continue automatically from the remaining questions.',

            'resumed' =>
                array_sum($existingCounts) > 0,

            'resumable' =>
                !$complete,

            'topic_id' =>
                $topic->id,

            'topic_name' =>
                $topic->name,

            /*
            |--------------------------------------------------------------------------
            | Progress
            |--------------------------------------------------------------------------
            */

            'progress' => [
                'easy' => [
                    'current' =>
                        $finalCounts['easy'],

                    'target' =>
                        $targets['easy'],

                    'remaining' =>
                        $remaining['easy'],
                ],

                'medium' => [
                    'current' =>
                        $finalCounts['medium'],

                    'target' =>
                        $targets['medium'],

                    'remaining' =>
                        $remaining['medium'],
                ],

                'hard' => [
                    'current' =>
                        $finalCounts['hard'],

                    'target' =>
                        $targets['hard'],

                    'remaining' =>
                        $remaining['hard'],
                ],

                'total_current' =>
                    $totalCurrent,

                'total_target' =>
                    $totalRequested,

                'total_remaining' =>
                    array_sum($remaining),

                'percentage' =>
                    $totalRequested > 0
                        ? round(
                            (
                                $totalCurrent /
                                $totalRequested
                            ) * 100,
                            2
                        )
                        : 100,
            ],

            /*
            |--------------------------------------------------------------------------
            | Direct count fields
            |--------------------------------------------------------------------------
            */

            'current_counts' =>
                $finalCounts,

            'remaining' =>
                $remaining,

            /*
            |--------------------------------------------------------------------------
            | Configuration
            |--------------------------------------------------------------------------
            */

            'configuration' => [
                'easy_questions' =>
                    $targets['easy'],

                'medium_questions' =>
                    $targets['medium'],

                'hard_questions' =>
                    $targets['hard'],

                'total_questions' =>
                    $totalRequested,

                'batch_size' =>
                    self::MAX_BATCH_SIZE,

                'existing_easy' =>
                    $existingCounts['easy'],

                'existing_medium' =>
                    $existingCounts['medium'],

                'existing_hard' =>
                    $existingCounts['hard'],

                'final_easy' =>
                    $finalCounts['easy'],

                'final_medium' =>
                    $finalCounts['medium'],

                'final_hard' =>
                    $finalCounts['hard'],

                'generated_now_easy' =>
                    $generatedNow['easy'],

                'generated_now_medium' =>
                    $generatedNow['medium'],

                'generated_now_hard' =>
                    $generatedNow['hard'],
            ],

            'generated_now' =>
                $generatedNow,

            'data' => [
                'topic_id' =>
                    $topic->id,

                'topic_name' =>
                    $topic->name,

                'questions' =>
                    $questions,
            ],
        ];

        if ($error !== null) {
            $response['error'] = $error;
        }

        return response()->json(
            $response,
            $success && $complete
                ? 200
                : 500
        );
    }
}
