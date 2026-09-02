<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\LessonAssignment;
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
     * One AI request can generate all difficulties for one topic.
     */
    private const DEFAULT_BATCH_SIZE = 10;

    private const MAX_BATCH_SIZE = 10;

    private const MAX_GENERATION_ATTEMPTS = 3;

    /*
     * Small delay only when a retry is needed.
     */
    private const RETRY_DELAY_MS = 300;

    /*
    |--------------------------------------------------------------------------
    | STAGE 1
    |--------------------------------------------------------------------------
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

        try {
            /*
            |--------------------------------------------------------------------------
            | 1. Extract PDF
            |--------------------------------------------------------------------------
            */

            $file = $request->file('file');

            if (!$file || !$file->isValid()) {
                throw new RuntimeException(
                    'The uploaded PDF is invalid or could not be read.'
                );
            }

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

            /*
            |--------------------------------------------------------------------------
            | Normalize whitespace
            |--------------------------------------------------------------------------
            */

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
            | 2. Limit material sent to AI
            |--------------------------------------------------------------------------
            */

            if (mb_strlen($content) > self::PDF_MAX_CHARS) {
                $content = mb_substr(
                    $content,
                    0,
                    self::PDF_MAX_CHARS
                );

                Log::info(
                    'PDF content truncated before AI generation.',
                    [
                        'max_chars' =>
                            self::PDF_MAX_CHARS,
                    ]
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 3. Determine lesson title
            |--------------------------------------------------------------------------
            */

            $requestedTitle = trim(
                $validated['lesson_title'] ?? ''
            );

            if ($requestedTitle !== '') {
                $lessonTitle = $requestedTitle;
            } else {
                $lessonTitle = 'AI Generated Lesson';
            }

            /*
            |--------------------------------------------------------------------------
            | 4. Generate lesson + topics
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

Requested lesson title:
{$lessonTitle}

Learning material:
{$content}
PROMPT;

            $startTime = microtime(true);

            $result = $groq->generateJson(
                $prompt,
                1400
            );

            $durationMs = (int) round(
                (
                    microtime(true) - $startTime
                ) * 1000
            );

            Log::info(
                'AI LESSON STAGE 1: AI SUCCESS',
                [
                    'duration_ms' => $durationMs,
                    'model' => $groq->getModel(),
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | 5. Validate AI result
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
                        $topicData['name'] ?? ''
                    )
                );

                $topicDescription = trim(
                    (string) (
                        $topicData['description'] ?? ''
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
                count($cleanTopics) < 3
                ||
                count($cleanTopics) > 8
            ) {
                throw new RuntimeException(
                    'AI must generate between 3 and 8 valid topics. '
                    . 'Generated: '
                    . count($cleanTopics)
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 6. Save atomically
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

                    foreach ($cleanTopics as $topicData) {
                        Topic::create([
                            'lesson_id' => $lesson->id,
                            'name' => $topicData['name'],
                            'description' =>
                                $topicData['description'],
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

            /*
            |--------------------------------------------------------------------------
            | 7. Question configuration
            |--------------------------------------------------------------------------
            */

            $easy = (int) $validated['easy_questions'];

            $medium = (int) $validated['medium_questions'];

            $hard = (int) $validated['hard_questions'];

            $total = $easy + $medium + $hard;

            Log::info(
                'AI LESSON STAGE 1 SUCCESS',
                [
                    'lesson_id' => $lesson->id,
                    'user_id' => $userId,
                    'topic_count' =>
                        $lesson->topics->count(),
                    'total_questions_per_topic' =>
                        $total,
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

                    'user_id' =>
                        $request->input('user_id'),

                    'exception' =>
                        get_class($e),
                ]
            );

            $message = $e->getMessage();

            $isRateLimited =
                str_contains(
                    strtolower($message),
                    'rate limit'
                )
                ||
                str_contains(
                    strtolower($message),
                    '429'
                );

            return response()->json([
                'success' => false,

                'message' =>
                    $isRateLimited
                        ? 'The AI provider rate limit was reached. Please wait for the limit to reset and try again.'
                        : 'Failed to generate lesson and topics.',

                'error' => $message,

                'rate_limited' =>
                    $isRateLimited,

                'resumable' => false,

            ], $isRateLimited ? 429 : 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | STAGE 2
    |--------------------------------------------------------------------------
    | ONE AI REQUEST PER TOPIC
    |--------------------------------------------------------------------------
    |
    | Instead of:
    |
    |   Easy -> AI
    |   Medium -> AI
    |   Hard -> AI
    |
    | We now do:
    |
    |   Easy + Medium + Hard -> ONE AI request
    |
    |--------------------------------------------------------------------------
    */

    public function generateTopicQuestions(
        Request $request,
        GroqService $groq
    ) {
        Log::info(
            'AI LESSON STAGE 2: START',
            [
                'topic_id' =>
                    $request->input('topic_id'),

                'easy_questions' =>
                    $request->input('easy_questions'),

                'medium_questions' =>
                    $request->input('medium_questions'),

                'hard_questions' =>
                    $request->input('hard_questions'),
            ]
        );

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

        try {

            /*
            |--------------------------------------------------------------------------
            | 1. Load topic + lesson
            |--------------------------------------------------------------------------
            */

            $topic = Topic::with('lesson')
                ->findOrFail(
                    $validated['topic_id']
                );

            $lesson = $topic->lesson;

            if (!$lesson) {
                throw new RuntimeException(
                    'The topic does not have a valid lesson.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 2. Targets
            |--------------------------------------------------------------------------
            */

            $targets = [
                'easy' =>
                    (int) $validated['easy_questions'],

                'medium' =>
                    (int) $validated['medium_questions'],

                'hard' =>
                    (int) $validated['hard_questions'],
            ];

            $totalRequested =
                array_sum($targets);

            if ($totalRequested <= 0) {
                return response()->json([
                    'success' => true,

                    'stage' =>
                        'topic_questions',

                    'message' =>
                        'No questions requested.',

                    'data' => [
                        'topic_id' =>
                            $topic->id,

                        'topic_name' =>
                            $topic->name,

                        'questions' => [],
                    ],
                ]);
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
            | 4. Efficient DB count helper
            |--------------------------------------------------------------------------
            */

            $getCounts = function () use ($topic): array {

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

                    $difficulty =
                        strtolower(
                            trim(
                                (string)
                                    $row->difficulty
                            )
                        );

                    if (
                        isset(
                            $counts[$difficulty]
                        )
                    ) {
                        $counts[$difficulty] =
                            (int)
                                $row->aggregate;
                    }
                }

                return $counts;
            };

            $existingCounts =
                $getCounts();

            /*
            |--------------------------------------------------------------------------
            | 5. Calculate remaining
            |--------------------------------------------------------------------------
            */

            $calculateRemaining =
                static function (
                    array $targets,
                    array $counts
                ): array {
                    return [
                        'easy' => max(
                            0,
                            $targets['easy']
                            -
                            $counts['easy']
                        ),

                        'medium' => max(
                            0,
                            $targets['medium']
                            -
                            $counts['medium']
                        ),

                        'hard' => max(
                            0,
                            $targets['hard']
                            -
                            $counts['hard']
                        ),
                    ];
                };

            $remaining =
                $calculateRemaining(
                    $targets,
                    $existingCounts
                );

            /*
            |--------------------------------------------------------------------------
            | 6. Already complete
            |--------------------------------------------------------------------------
            */

            if (
                array_sum($remaining) === 0
            ) {
                return $this->topicGenerationResponse(
                    $topic,
                    $targets,
                    $existingCounts,
                    $existingCounts,
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
            | 7. Existing question cache
            |--------------------------------------------------------------------------
            */

            $existingQuestionKeys = [];

            $existingQuestionTexts = $topic
                ->questions()
                ->select('question')
                ->pluck('question');

            foreach (
                $existingQuestionTexts
                as $questionText
            ) {
                $key = $normalize(
                    (string) $questionText
                );

                if ($key !== '') {
                    $existingQuestionKeys[
                        $key
                    ] = true;
                }
            }

            /*
            |--------------------------------------------------------------------------
            | 8. Current remaining counts
            |--------------------------------------------------------------------------
            */

            $remainingEasy =
                $remaining['easy'];

            $remainingMedium =
                $remaining['medium'];

            $remainingHard =
                $remaining['hard'];

            $remainingTotal =
                array_sum($remaining);

            /*
            |--------------------------------------------------------------------------
            | 9. ONE AI REQUEST
            |--------------------------------------------------------------------------
            */

            $prompt = <<<PROMPT
You are an expert educational assessment writer.

Generate NEW multiple-choice questions for the topic below.

LESSON:
{$lesson->title}

LESSON DESCRIPTION:
{$lesson->description}

TOPIC:
{$topic->name}

TOPIC DESCRIPTION:
{$topic->description}

REQUIRED QUESTIONS:

Easy: {$remainingEasy}
Medium: {$remainingMedium}
Hard: {$remainingHard}

TOTAL QUESTIONS:
{$remainingTotal}

STRICT RULES:

- Generate exactly the requested number for each difficulty whenever possible.
- Never generate more than the requested number.
- Every question must directly test the topic.
- Questions must be educationally meaningful.
- Avoid trick questions.
- Avoid ambiguous questions.
- Avoid duplicate questions.
- Every question must have exactly four different choices.
- correct_answer must be exactly A, B, C, or D.
- The correct answer must be objectively defensible.
- Keep explanations concise.
- Difficulty must exactly match the requested difficulty.
- Points must always be 1.
- Do not use markdown.
- Do not add extra JSON fields.
- Do not include text outside JSON.

Return ONLY valid JSON.

Required structure:

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
      "difficulty": "easy",
      "points": 1
    }
  ]
}

The final response must contain:

- {$remainingEasy} easy questions
- {$remainingMedium} medium questions
- {$remainingHard} hard questions
PROMPT;

            /*
            |--------------------------------------------------------------------------
            | 10. Token budget
            |--------------------------------------------------------------------------
            */

            $maxTokens = max(
                2000,
                min(
                    6500,
                    $remainingTotal * 220
                )
            );

            $generatedNow = [
                'easy' => 0,
                'medium' => 0,
                'hard' => 0,
            ];

            /*
            |--------------------------------------------------------------------------
            | 11. Generate with retry
            |--------------------------------------------------------------------------
            */

            $attempt = 0;

            $validQuestions = [];

            while (
                $attempt
                <
                self::MAX_GENERATION_ATTEMPTS
            ) {
                $attempt++;

                try {

                    Log::info(
                        'AI QUESTION GENERATION: SINGLE REQUEST START',
                        [
                            'topic_id' =>
                                $topic->id,

                            'easy' =>
                                $remainingEasy,

                            'medium' =>
                                $remainingMedium,

                            'hard' =>
                                $remainingHard,

                            'total' =>
                                $remainingTotal,

                            'attempt' =>
                                $attempt,

                            'max_tokens' =>
                                $maxTokens,

                            'model' =>
                                $groq->getModel(),
                        ]
                    );

                    $startTime =
                        microtime(true);

                    $result =
                        $groq->generateJson(
                            $prompt,
                            $maxTokens
                        );

                    $durationMs =
                        (int) round(
                            (
                                microtime(true)
                                -
                                $startTime
                            ) * 1000
                        );

                    Log::info(
                        'AI QUESTION GENERATION: SINGLE REQUEST SUCCESS',
                        [
                            'topic_id' =>
                                $topic->id,

                            'duration_ms' =>
                                $durationMs,

                            'model' =>
                                $groq->getModel(),
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

                    /*
                    |--------------------------------------------------------------------------
                    | 12. Validate questions
                    |--------------------------------------------------------------------------
                    */

                    $validQuestions = [];

                    $batchKeys = [];

                    $difficultyCounters = [
                        'easy' => 0,
                        'medium' => 0,
                        'hard' => 0,
                    ];

                    foreach (
                        $questions
                        as $question
                    ) {

                        if (
                            !is_array($question)
                        ) {
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
                                    $question[
                                        'question'
                                    ] ?? ''
                                )
                            );

                        if (
                            $questionText === ''
                        ) {
                            continue;
                        }

                        $questionKey =
                            $normalize(
                                $questionText
                            );

                        if (
                            $questionKey === ''
                        ) {
                            continue;
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Existing duplicate
                        |--------------------------------------------------------------------------
                        */

                        if (
                            isset(
                                $existingQuestionKeys[
                                    $questionKey
                                ]
                            )
                        ) {
                            Log::debug(
                                'AI duplicate filtered.',
                                [
                                    'topic_id' =>
                                        $topic->id,
                                ]
                            );

                            continue;
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Duplicate inside current response
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
                        */

                        $difficulty =
                            strtolower(
                                trim(
                                    (string) (
                                        $question[
                                            'difficulty'
                                        ] ?? ''
                                    )
                                )
                            );

                        if (
                            !in_array(
                                $difficulty,
                                [
                                    'easy',
                                    'medium',
                                    'hard',
                                ],
                                true
                            )
                        ) {
                            continue;
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Do not exceed target
                        |--------------------------------------------------------------------------
                        */

                        if (
                            $difficultyCounters[
                                $difficulty
                            ]
                            >=
                            $remaining[
                                $difficulty
                            ]
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
                                    $question[
                                        'choice_a'
                                    ] ?? ''
                                )
                            );

                        $choiceB =
                            trim(
                                (string) (
                                    $question[
                                        'choice_b'
                                    ] ?? ''
                                )
                            );

                        $choiceC =
                            trim(
                                (string) (
                                    $question[
                                        'choice_c'
                                    ] ?? ''
                                )
                            );

                        $choiceD =
                            trim(
                                (string) (
                                    $question[
                                        'choice_d'
                                    ] ?? ''
                                )
                            );

                        if (
                            $choiceA === ''
                            ||
                            $choiceB === ''
                            ||
                            $choiceC === ''
                            ||
                            $choiceD === ''
                        ) {
                            continue;
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Choices must be unique
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
                                        ] ?? ''
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
                                    ] ?? ''
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

                            'points' => 1,
                        ];

                        $batchKeys[
                            $questionKey
                        ] = true;

                        $difficultyCounters[
                            $difficulty
                        ]++;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | 13. At least one valid question
                    |--------------------------------------------------------------------------
                    */

                    if (
                        count($validQuestions) === 0
                    ) {
                        throw new RuntimeException(
                            'AI returned no valid unique questions.'
                        );
                    }

                    break;

                } catch (Throwable $e) {

                    Log::warning(
                        'AI QUESTION SINGLE REQUEST FAILED',
                        [
                            'topic_id' =>
                                $topic->id,

                            'attempt' =>
                                $attempt,

                            'message' =>
                                $e->getMessage(),
                        ]
                    );

                    if (
                        $attempt
                        >=
                        self::MAX_GENERATION_ATTEMPTS
                    ) {
                        throw $e;
                    }

                    usleep(
                        self::RETRY_DELAY_MS * 1000
                    );
                }
            }

            /*
            |--------------------------------------------------------------------------
            | 14. Save valid questions
            |--------------------------------------------------------------------------
            */

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
                                    $question[
                                        'question'
                                    ]
                                );

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
                                        $question[
                                            'question'
                                        ]
                                    )
                                    ->exists();

                            if (
                                $alreadyExists
                            ) {
                                continue;
                            }

                            $topic
                                ->questions()
                                ->create([
                                    'question' =>
                                        $question[
                                            'question'
                                        ],

                                    'choice_a' =>
                                        $question[
                                            'choice_a'
                                        ],

                                    'choice_b' =>
                                        $question[
                                            'choice_b'
                                        ],

                                    'choice_c' =>
                                        $question[
                                            'choice_c'
                                        ],

                                    'choice_d' =>
                                        $question[
                                            'choice_d'
                                        ],

                                    'correct_answer' =>
                                        $question[
                                            'correct_answer'
                                        ],

                                    'explanation' =>
                                        $question[
                                            'explanation'
                                        ],

                                    'difficulty' =>
                                        $question[
                                            'difficulty'
                                        ],

                                    'points' =>
                                        $question[
                                            'points'
                                        ],
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
            | 15. Track generated counts
            |--------------------------------------------------------------------------
            */

            foreach (
                $validQuestions
                as $question
            ) {

                $difficulty =
                    $question['difficulty'];

                if (
                    isset(
                        $generatedNow[
                            $difficulty
                        ]
                    )
                ) {
                    $generatedNow[
                        $difficulty
                    ]++;
                }
            }

            Log::info(
                'AI QUESTION SINGLE REQUEST SAVED',
                [
                    'topic_id' =>
                        $topic->id,

                    'requested' => [
                        'easy' =>
                            $remainingEasy,

                        'medium' =>
                            $remainingMedium,

                        'hard' =>
                            $remainingHard,
                    ],

                    'valid_from_ai' =>
                        count($validQuestions),

                    'saved' =>
                        $savedCount,

                    'generated_now' =>
                        $generatedNow,
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | 16. Final DB state
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
            | 17. Incomplete
            |--------------------------------------------------------------------------
            */

            if (
                array_sum(
                    $finalRemaining
                ) > 0
            ) {

                Log::warning(
                    'AI QUESTION GENERATION INCOMPLETE',
                    [
                        'topic_id' =>
                            $topic->id,

                        'targets' =>
                            $targets,

                        'final_counts' =>
                            $finalCounts,

                        'remaining' =>
                            $finalRemaining,
                    ]
                );

                return $this->topicGenerationResponse(
                    $topic,
                    $targets,
                    $existingCounts,
                    $finalCounts,
                    $generatedNow,
                    false,
                    'Some questions were generated successfully, but the requested total was not reached. Retry this topic to generate the remaining questions.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | 18. Success
            |--------------------------------------------------------------------------
            */

            $wasResumed =
                array_sum(
                    $existingCounts
                ) > 0;

            Log::info(
                'AI LESSON STAGE 2 SUCCESS',
                [
                    'topic_id' =>
                        $topic->id,

                    'easy' =>
                        $finalCounts['easy'],

                    'medium' =>
                        $finalCounts['medium'],

                    'hard' =>
                        $finalCounts['hard'],

                    'generated_now' =>
                        $generatedNow,

                    'resumed' =>
                        $wasResumed,
                ]
            );

            return $this->topicGenerationResponse(
                $topic,
                $targets,
                $existingCounts,
                $finalCounts,
                $generatedNow,
                true
            );

        } catch (Throwable $e) {

            Log::error(
                'AI LESSON STAGE 2 FAILED',
                [
                    'topic_id' =>
                        $validated['topic_id']
                        ?? null,

                    'message' =>
                        $e->getMessage(),

                    'exception' =>
                        get_class($e),
                ]
            );

            $isRateLimited =
                str_contains(
                    strtolower(
                        $e->getMessage()
                    ),
                    'rate limit'
                )
                ||
                str_contains(
                    strtolower(
                        $e->getMessage()
                    ),
                    '429'
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
                    $validated['topic_id']
                    ?? null,

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

        $complete =
            (
                $finalCounts['easy']
                >=
                $targets['easy']
            )
            &&
            (
                $finalCounts['medium']
                >=
                $targets['medium']
            )
            &&
            (
                $finalCounts['hard']
                >=
                $targets['hard']
            );

        /*
        |--------------------------------------------------------------------------
        | Only load questions on completion
        |--------------------------------------------------------------------------
        */

        $questions = [];

        if ($success || $complete) {
            $questions =
                $topic
                    ->questions()
                    ->orderBy('id')
                    ->get();
        }

        $response = [
            'success' =>
                $success && $complete,

            'stage' =>
                'topic_questions',

            'message' =>
                ($success && $complete)
                    ? (
                        array_sum(
                            $existingCounts
                        ) > 0
                            ? 'Topic questions successfully resumed and completed.'
                            : 'Topic questions generated successfully.'
                    )
                    : 'Question generation was paused. Successfully generated questions were preserved. Retry this topic to continue automatically from the remaining questions.',

            'resumed' =>
                array_sum(
                    $existingCounts
                ) > 0,

            'resumable' =>
                !$complete,

            'topic_id' =>
                $topic->id,

            'topic_name' =>
                $topic->name,

            'progress' => [

                'easy' => [
                    'current' =>
                        $finalCounts['easy'],

                    'target' =>
                        $targets['easy'],

                    'remaining' =>
                        max(
                            0,
                            $targets['easy']
                            -
                            $finalCounts['easy']
                        ),
                ],

                'medium' => [
                    'current' =>
                        $finalCounts['medium'],

                    'target' =>
                        $targets['medium'],

                    'remaining' =>
                        max(
                            0,
                            $targets['medium']
                            -
                            $finalCounts['medium']
                        ),
                ],

                'hard' => [
                    'current' =>
                        $finalCounts['hard'],

                    'target' =>
                        $targets['hard'],

                    'remaining' =>
                        max(
                            0,
                            $targets['hard']
                            -
                            $finalCounts['hard']
                        ),
                ],

                'total_current' =>
                    $totalCurrent,

                'total_target' =>
                    $totalRequested,

                'percentage' =>
                    $totalRequested > 0
                        ? round(
                            (
                                $totalCurrent
                                /
                                $totalRequested
                            ) * 100,
                            2
                        )
                        : 100,
            ],

            'configuration' => [

                'easy_questions' =>
                    $targets['easy'],

                'medium_questions' =>
                    $targets['medium'],

                'hard_questions' =>
                    $targets['hard'],

                'total_questions' =>
                    $totalRequested,

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
        ];

        if ($error !== null) {
            $response['error'] = $error;
        }

        if (count($questions) > 0) {

            $response['data'] = [
                'topic_id' =>
                    $topic->id,

                'topic_name' =>
                    $topic->name,

                'questions' =>
                    $questions,
            ];

        } else {

            $response['data'] = [
                'topic_id' =>
                    $topic->id,

                'topic_name' =>
                    $topic->name,

                'questions' => [],
            ];
        }

        return response()->json(
            $response,
            $success ? 200 : 500
        );
    }
}