<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\AssessmentAttempt;
use App\Models\AssessmentQuestion;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AssessmentController extends Controller
{
    // ============================================================
    // GENERATE ASSESSMENTS FROM LESSON TOPICS
    // ============================================================

    public function generate(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $validated = $request->validate([
            'lesson_id' => [
                'required',
                'integer',
                'exists:lessons,id',
            ],
        ]);

        $lessonId = (int) $validated['lesson_id'];

        Log::info('ASSESSMENT GENERATION STARTED', [
            'lesson_id' => $lessonId,
            'user_id' => $user->id,
        ]);

        $topics = Topic::query()
            ->where('lesson_id', $lessonId)
            ->with([
                'questions:id,topic_id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation',
            ])
            ->orderBy('topic_order')
            ->get();

        if ($topics->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No topics were found for this lesson.',
            ], 422);
        }

        $topicsWithoutQuestions = $topics
            ->filter(
                fn ($topic) => $topic->questions->isEmpty()
            )
            ->values();

        if ($topicsWithoutQuestions->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Some topics do not have generated questions yet.',
                'incomplete_topics' => $topicsWithoutQuestions
                    ->map(function ($topic) {
                        return [
                            'topic_id' => $topic->id,
                            'topic_name' => $topic->name,
                            'question_count' => 0,
                        ];
                    })
                    ->values(),
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($topics) {
                $assessments = [];
                $totalQuestionsCreated = 0;

                foreach ($topics as $index => $topic) {
                    $questions = $topic
                        ->questions
                        ->shuffle()
                        ->values();

                    $questionCount = $questions->count();

                    $totalPoints = $questions->sum(
                        fn ($question) => (int) ($question->points ?? 1)
                    );

                    $assessment = Assessment::firstOrNew([
                        'topic_id' => $topic->id,
                    ]);

                    $assessment->title =
                        'Assessment ' .
                        ($index + 1) .
                        ' - ' .
                        $topic->name;

                    $assessment->description =
                        $topic->description ??
                        'Assessment for ' . $topic->name;

                    $assessment->total_questions = $questionCount;
                    $assessment->total_points = $totalPoints;

                    $assessment->save();

                    // Remove old question links when regenerating.
                    AssessmentQuestion::query()
                        ->where(
                            'assessment_id',
                            $assessment->id
                        )
                        ->delete();

                    $pivotRows = [];

                    foreach ($questions as $questionIndex => $question) {
                        $pivotRows[] = [
                            'assessment_id' => $assessment->id,
                            'question_id' => $question->id,
                            'question_order' => $questionIndex + 1,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }

                    if (!empty($pivotRows)) {
                        AssessmentQuestion::insert($pivotRows);
                    }

                    $assessments[] = [
                        'id' => $assessment->id,
                        'assessment_number' => $index + 1,
                        'topic_id' => $topic->id,
                        'topic_name' => $topic->name,
                        'title' => $assessment->title,
                        'description' => $assessment->description,
                        'total_questions' => $questionCount,
                        'total_points' => $totalPoints,
                    ];

                    $totalQuestionsCreated += $questionCount;
                }

                return [
                    'assessments' => $assessments,
                    'total_assessments' => count($assessments),
                    'total_questions' => $totalQuestionsCreated,
                ];
            });

            Log::info('ASSESSMENT GENERATION COMPLETED', [
                'lesson_id' => $lessonId,
                'user_id' => $user->id,
                'total_assessments' => $result['total_assessments'],
                'total_questions' => $result['total_questions'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Assessments generated successfully.',
                'lesson_id' => $lessonId,
                'total_assessments' => $result['total_assessments'],
                'total_questions' => $result['total_questions'],
                'data' => $result['assessments'],
            ]);
        } catch (\Throwable $e) {
            Log::error('ASSESSMENT GENERATION FAILED', [
                'lesson_id' => $lessonId,
                'user_id' => $user->id,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate assessments.',
                'error' => config('app.debug')
                    ? $e->getMessage()
                    : null,
            ], 500);
        }
    }


    // ============================================================
    // GET ALL ASSESSMENTS
    // ============================================================

    public function index(Request $request): JsonResponse
    {
        try {
            $assessments = Assessment::query()
                ->with([
                    'topic',
                    'questions',
                ])
                ->orderBy('topic_id')
                ->get();

            $assessments = $assessments->map(
                function ($assessment) {
                    return $this->attachAttemptData($assessment);
                }
            );

            return response()->json([
                'success' => true,
                'data' => $assessments,
            ]);
        } catch (\Throwable $e) {
            Log::error('ASSESSMENT INDEX FAILED', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load assessments.',
                'error' => config('app.debug')
                    ? $e->getMessage()
                    : null,
            ], 500);
        }
    }


    // ============================================================
    // GET ONE ASSESSMENT
    // ============================================================

    public function show(
        Request $request,
        Assessment $assessment
    ): JsonResponse {
        try {
            $assessment->load([
                'topic',
                'questions',
            ]);

            $assessment = $this->attachAttemptData(
                $assessment
            );

            return response()->json([
                'success' => true,
                'data' => $assessment,
            ]);
        } catch (\Throwable $e) {
            Log::error('ASSESSMENT SHOW FAILED', [
                'assessment_id' => $assessment->id,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load assessment.',
                'error' => config('app.debug')
                    ? $e->getMessage()
                    : null,
            ], 500);
        }
    }


    // ============================================================
    // SUBMIT ASSESSMENT
    // ============================================================

    public function submit(
        Request $request,
        Assessment $assessment
    ): JsonResponse {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }

            // ----------------------------------------------------
            // LOAD QUESTIONS
            // ----------------------------------------------------

            $assessment->load([
                'questions' => function ($query) {
                    $query->orderBy(
                        'assessment_questions.question_order'
                    );
                },
            ]);

            $questions = $assessment->questions;

            if ($questions->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This assessment has no questions.',
                ], 422);
            }

            // ----------------------------------------------------
            // CHECK PREVIOUS ATTEMPT
            // ----------------------------------------------------
            //
            // If already passed, the assessment is permanently
            // locked for this user.
            //
            // Failed assessments can be retaken.
            // ----------------------------------------------------

            $latestAttempt = AssessmentAttempt::query()
                ->where(
                    'assessment_id',
                    $assessment->id
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->latest('attempt_number')
                ->first();

            if (
                $latestAttempt &&
                $latestAttempt->status === 'passed'
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'This assessment has already been passed and is locked.',
                    'locked' => true,
                    'passed' => true,
                    'score' => (float) $latestAttempt->score,
                    'attempt_number' =>
                        $latestAttempt->attempt_number,
                ], 403);
            }

            // ----------------------------------------------------
            // GET SUBMITTED ANSWERS
            // ----------------------------------------------------

            $submittedAnswers =
                $request->input('answers');

            if (!is_array($submittedAnswers)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid answers format.',
                ], 422);
            }

            // ----------------------------------------------------
            // NORMALIZE ANSWERS
            // ----------------------------------------------------

            $answersByQuestionId = [];

            foreach ($submittedAnswers as $key => $value) {

                // -----------------------------------------------
                // OBJECT FORMAT
                // -----------------------------------------------
                //
                // [
                //     [
                //         'question_id' => 123,
                //         'answer' => 'B'
                //     ]
                // ]
                // -----------------------------------------------

                if (is_array($value)) {
                    $questionId =
                        $value['question_id']
                        ?? $value['questionId']
                        ?? $value['id']
                        ?? null;

                    $answer =
                        $value['answer']
                        ?? $value['selected_answer']
                        ?? $value['selectedAnswer']
                        ?? $value['user_answer']
                        ?? $value['userAnswer']
                        ?? null;

                    if (
                        $questionId !== null &&
                        $answer !== null
                    ) {
                        $answersByQuestionId[
                            (int) $questionId
                        ] = strtoupper(
                            trim((string) $answer)
                        );
                    }

                    continue;
                }

                // -----------------------------------------------
                // ASSOCIATIVE FORMAT
                // -----------------------------------------------

                if (
                    is_string($key) &&
                    is_numeric($key)
                ) {
                    $answersByQuestionId[
                        (int) $key
                    ] = strtoupper(
                        trim((string) $value)
                    );
                }
            }

            // ----------------------------------------------------
            // REQUIRED QUESTION IDS
            // ----------------------------------------------------

            $requiredQuestionIds = $questions
                ->pluck('id')
                ->map(
                    fn ($id) => (int) $id
                )
                ->values();

            // ----------------------------------------------------
            // CHECK MISSING ANSWERS
            // ----------------------------------------------------

            $missingQuestionIds =
                $requiredQuestionIds
                    ->filter(
                        fn ($id) =>
                            !array_key_exists(
                                $id,
                                $answersByQuestionId
                            )
                            ||
                            empty(
                                $answersByQuestionId[$id]
                            )
                    )
                    ->values();

            if ($missingQuestionIds->isNotEmpty()) {
                Log::warning(
                    'Assessment submission missing answers',
                    [
                        'assessment_id' =>
                            $assessment->id,

                        'user_id' =>
                            $user->id,

                        'required_question_ids' =>
                            $requiredQuestionIds->toArray(),

                        'received_question_ids' =>
                            array_keys(
                                $answersByQuestionId
                            ),

                        'missing_question_ids' =>
                            $missingQuestionIds->toArray(),
                    ]
                );

                return response()->json([
                    'success' => false,
                    'message' =>
                        'Please answer all questions before submitting the assessment.',
                    'required' =>
                        $requiredQuestionIds->count(),
                    'received' =>
                        count($answersByQuestionId),
                    'missing_question_ids' =>
                        $missingQuestionIds->toArray(),
                ], 422);
            }

            // ----------------------------------------------------
            // CALCULATE SCORE
            // ----------------------------------------------------

            $correctAnswers = 0;
            $totalQuestions = $questions->count();

            foreach ($questions as $question) {
                $questionId = (int) $question->id;

                $submittedAnswer =
                    $answersByQuestionId[$questionId]
                    ?? null;

                $correctAnswer = strtoupper(
                    trim(
                        (string) $question->correct_answer
                    )
                );

                if (
                    $submittedAnswer !== null &&
                    $submittedAnswer === $correctAnswer
                ) {
                    $correctAnswers++;
                }
            }

            // ----------------------------------------------------
            // SCORE
            // ----------------------------------------------------
            //
            // Score is based on number of correct answers.
            //
            // Example:
            // 3 / 3 = 100%
            // 2 / 3 = 66.67%
            // 1 / 3 = 33.33%
            // ----------------------------------------------------

            $score = $totalQuestions > 0
                ? round(
                    ($correctAnswers / $totalQuestions) * 100,
                    2
                )
                : 0;

            // ----------------------------------------------------
            // PASSING SCORE
            // ----------------------------------------------------

            $passed = $score >= 60;

            $status = $passed
                ? 'passed'
                : 'failed';

            // ----------------------------------------------------
            // ATTEMPT NUMBER
            // ----------------------------------------------------

            $attemptNumber = AssessmentAttempt::query()
                ->where(
                    'assessment_id',
                    $assessment->id
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->max('attempt_number');

            $attemptNumber =
                ((int) $attemptNumber) + 1;

            // ----------------------------------------------------
            // CREATE ATTEMPT
            // ----------------------------------------------------

            $attempt = DB::transaction(
                function () use (
                    $assessment,
                    $user,
                    $attemptNumber,
                    $correctAnswers,
                    $totalQuestions,
                    $score,
                    $status
                ) {
                    return AssessmentAttempt::create([
                        'assessment_id' =>
                            $assessment->id,

                        'user_id' =>
                            $user->id,

                        'attempt_number' =>
                            $attemptNumber,

                        'correct' =>
                            $correctAnswers,

                        'total' =>
                            $totalQuestions,

                        'score' =>
                            $score,

                        'status' =>
                            $status,
                    ]);
                }
            );

            // ----------------------------------------------------
            // LOG
            // ----------------------------------------------------

            Log::info(
                'ASSESSMENT SUBMITTED SUCCESSFULLY',
                [
                    'assessment_id' =>
                        $assessment->id,

                    'user_id' =>
                        $user->id,

                    'attempt_id' =>
                        $attempt->id,

                    'attempt_number' =>
                        $attemptNumber,

                    'correct' =>
                        $correctAnswers,

                    'total' =>
                        $totalQuestions,

                    'score' =>
                        $score,

                    'status' =>
                        $status,
                ]
            );

            // ----------------------------------------------------
            // RESPONSE
            // ----------------------------------------------------

            return response()->json([
                'success' => true,

                'message' =>
                    $passed
                        ? 'Assessment passed successfully.'
                        : 'Assessment failed. You can try again.',

                'data' => [
                    'assessment_id' =>
                        $assessment->id,

                    'attempt_id' =>
                        $attempt->id,

                    'attempt_number' =>
                        $attemptNumber,

                    'correct' =>
                        $correctAnswers,

                    'total' =>
                        $totalQuestions,

                    'score' =>
                        $score,

                    'status' =>
                        $status,

                    'passed' =>
                        $passed,

                    'locked' =>
                        $passed,

                    'can_retake' =>
                        !$passed,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error(
                'Assessment submission failed',
                [
                    'assessment_id' =>
                        $assessment->id ?? null,

                    'user_id' =>
                        Auth::id(),

                    'error' =>
                        $e->getMessage(),

                    'file' =>
                        $e->getFile(),

                    'line' =>
                        $e->getLine(),
                ]
            );

            return response()->json([
                'success' => false,

                'message' =>
                    'Failed to submit assessment.',

                'error' =>
                    config('app.debug')
                        ? $e->getMessage()
                        : null,
            ], 500);
        }
    }


    // ============================================================
    // ATTACH ATTEMPT DATA
    // ============================================================

    private function attachAttemptData(
        Assessment $assessment
    ): Assessment {
        $user = Auth::user();

        if (!$user) {
            return $assessment;
        }

        // --------------------------------------------------------
        // GET LATEST ATTEMPT
        // --------------------------------------------------------

        $latestAttempt =
            AssessmentAttempt::query()
                ->where(
                    'assessment_id',
                    $assessment->id
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->latest('attempt_number')
                ->first();

        // --------------------------------------------------------
        // NO ATTEMPT
        // --------------------------------------------------------

        if (!$latestAttempt) {
            $assessment->attempted = false;
            $assessment->passed = false;
            $assessment->locked = false;
            $assessment->status = null;
            $assessment->score = null;
            $assessment->attempt_number = 0;
            $assessment->latest_attempt = null;

            return $assessment;
        }

        // --------------------------------------------------------
        // ATTEMPT EXISTS
        // --------------------------------------------------------

        $passed =
            $latestAttempt->status === 'passed';

        $assessment->attempted = true;
        $assessment->passed = $passed;
        $assessment->locked = $passed;
        $assessment->status =
            $latestAttempt->status;

        $assessment->score =
            (float) $latestAttempt->score;

        $assessment->attempt_number =
            (int) $latestAttempt->attempt_number;

        $assessment->latest_attempt = [
            'id' =>
                $latestAttempt->id,

            'attempt_number' =>
                $latestAttempt->attempt_number,

            'correct' =>
                $latestAttempt->correct,

            'total' =>
                $latestAttempt->total,

            'score' =>
                (float) $latestAttempt->score,

            'status' =>
                $latestAttempt->status,

            'passed' =>
                $passed,

            'locked' =>
                $passed,

            'can_retake' =>
                !$passed,

            'created_at' =>
                $latestAttempt->created_at,
        ];

        return $assessment;
    }


    // ============================================================
    // CALCULATE LEVEL
    // ============================================================

    private function calculateLevel(
        float $score
    ): int {
        if ($score >= 95) {
            return 10;
        }

        if ($score >= 90) {
            return 9;
        }

        if ($score >= 85) {
            return 8;
        }

        if ($score >= 80) {
            return 7;
        }

        if ($score >= 75) {
            return 6;
        }

        if ($score >= 70) {
            return 5;
        }

        if ($score >= 65) {
            return 4;
        }

        if ($score >= 60) {
            return 3;
        }

        if ($score >= 50) {
            return 2;
        }

        return 1;
    }


    // ============================================================
    // GET PROGRESS DATA
    // ============================================================

    private function getProgressData(
        $user
    ): array {
        $attempts =
            AssessmentAttempt::query()
                ->where(
                    'user_id',
                    $user->id
                )
                ->get();

        if ($attempts->isEmpty()) {
            return [
                'total_assessments' => 0,
                'completed_assessments' => 0,
                'passed_assessments' => 0,
                'failed_assessments' => 0,
                'total_correct' => 0,
                'total_wrong' => 0,
                'average_score' => 0,
                'level' => 1,
            ];
        }

        $completedAssessments =
            $attempts->count();

        $passedAssessments =
            $attempts
                ->where(
                    'status',
                    'passed'
                )
                ->count();

        $failedAssessments =
            $attempts
                ->where(
                    'status',
                    'failed'
                )
                ->count();

        $totalCorrect =
            $attempts->sum(
                fn ($attempt) =>
                    (int) (
                        $attempt->correct ?? 0
                    )
            );

        $totalWrong =
            $attempts->sum(
                fn ($attempt) =>
                    max(
                        0,
                        (int) (
                            $attempt->total ?? 0
                        ) -
                        (int) (
                            $attempt->correct ?? 0
                        )
                    )
            );

        $averageScore =
            round(
                $attempts->avg(
                    fn ($attempt) =>
                        (float) (
                            $attempt->score ?? 0
                        )
                ),
                2
            );

        $level =
            $this->calculateLevel(
                $averageScore
            );

        return [
            'total_assessments' =>
                $completedAssessments,

            'completed_assessments' =>
                $completedAssessments,

            'passed_assessments' =>
                $passedAssessments,

            'failed_assessments' =>
                $failedAssessments,

            'total_correct' =>
                $totalCorrect,

            'total_wrong' =>
                $totalWrong,

            'average_score' =>
                $averageScore,

            'level' =>
                $level,
        ];
    }
}