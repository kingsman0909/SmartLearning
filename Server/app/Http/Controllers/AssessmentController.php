<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\AssessmentAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AssessmentController extends Controller
{
    // ============================================================
    // LIST ASSESSMENTS
    // ============================================================

    public function index(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $assessments = Assessment::query()
            ->with([
                'questions:id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation'
            ])
            ->get();

        $assessments->each(function ($assessment) use ($user) {
            $this->attachAttemptData($assessment, $user);
        });

        return response()->json([
            'success' => true,
            'data' => $assessments,
        ]);
    }


    // ============================================================
    // SHOW SINGLE ASSESSMENT
    // ============================================================

    public function show(Assessment $assessment): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $assessment->load([
            'questions:id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation'
        ]);

        $this->attachAttemptData($assessment, $user);

        return response()->json([
            'success' => true,
            'data' => $assessment,
        ]);
    }


    // ============================================================
    // SUBMIT ASSESSMENT
    // ============================================================

    public function submit(
        Request $request,
        Assessment $assessment
    ): JsonResponse {

        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        Log::info('ASSESSMENT SUBMIT HIT', [
            'assessment_id' => $assessment->id,
            'user_id' => $user->id,
            'answers' => $request->all(),
        ]);

        // ========================================================
        // VALIDATION
        // ========================================================

        $validated = $request->validate([
            'answers' => [
                'required',
                'array',
                'min:1',
            ],

            'answers.*.question_id' => [
                'required',
                'integer',
            ],

            'answers.*.answer' => [
                'required',
                'string',
                'in:A,B,C,D',
            ],
        ]);

        // ========================================================
        // LOAD QUESTIONS THROUGH PIVOT
        // ========================================================

        $assessment->load([
            'questions:id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation'
        ]);

        $questions = $assessment->questions;

        if ($questions->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'This assessment has no questions.',
            ], 400);
        }

        $totalQuestions = $questions->count();

        // ========================================================
        // QUESTION IDS BELONGING TO THIS ASSESSMENT
        // ========================================================

        $questionIds = $questions
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        // ========================================================
        // LATEST ATTEMPT
        // ========================================================

        $latestAttempt = AssessmentAttempt::query()
            ->where('user_id', $user->id)
            ->where('assessment_id', $assessment->id)
            ->orderByDesc('attempt_number')
            ->first();

        // ========================================================
        // PASSED = LOCKED
        // ========================================================

        if (
            $latestAttempt &&
            $latestAttempt->status === 'passed'
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You have already passed this assessment.',
                'locked' => true,
                'status' => 'passed',
                'score' => (float) $latestAttempt->score,
                'correct' => (int) $latestAttempt->correct,
                'total' => (int) $latestAttempt->total,
                'attempt_number' => (int) $latestAttempt->attempt_number,
            ], 409);
        }

        // ========================================================
        // FORMAT SUBMITTED ANSWERS
        // ========================================================

        $submittedAnswers = collect($validated['answers'])
            ->keyBy(function ($answer) {
                return (int) $answer['question_id'];
            });

        // ========================================================
        // CHECK QUESTION OWNERSHIP
        // ========================================================

        foreach ($submittedAnswers as $questionId => $answerData) {

            if (!$questionIds->contains((int) $questionId)) {

                return response()->json([
                    'success' => false,
                    'message' =>
                        "Question {$questionId} does not belong to this assessment.",
                ], 422);
            }
        }

        // ========================================================
        // REQUIRE ALL QUESTIONS
        // ========================================================

        if ($submittedAnswers->count() !== $totalQuestions) {

            return response()->json([
                'success' => false,
                'message' =>
                    'You must answer all questions before submitting.',
            ], 422);
        }

        // ========================================================
        // CALCULATE SCORE
        // ========================================================

        $correct = 0;

        foreach ($questions as $question) {

            $submitted = $submittedAnswers->get(
                (int) $question->id
            );

            $selectedAnswer = strtoupper(
                trim($submitted['answer'] ?? '')
            );

            $correctAnswer = strtoupper(
                trim($question->correct_answer ?? '')
            );

            if (
                $selectedAnswer !== '' &&
                $selectedAnswer === $correctAnswer
            ) {
                $correct++;
            }
        }

        // ========================================================
        // SCORE
        // ========================================================

        $score = round(
            ($correct / $totalQuestions) * 100,
            2
        );

        // ========================================================
        // PASSING RULE
        // ========================================================

        $passingPercentage = 60;

        $passed = $score >= $passingPercentage;

        $status = $passed
            ? 'passed'
            : 'failed';

        // ========================================================
        // POINTS
        // ========================================================

        $pointsEarned = $passed
            ? $correct
            : 0;

        // ========================================================
        // ATTEMPT NUMBER
        // ========================================================

        $lastAttemptNumber = AssessmentAttempt::query()
            ->where('user_id', $user->id)
            ->where('assessment_id', $assessment->id)
            ->max('attempt_number');

        $attemptNumber = ((int) $lastAttemptNumber) + 1;

        // ========================================================
        // SAVE ATTEMPT + UPDATE USER PROGRESS
        // ========================================================

        try {

            $attempt = DB::transaction(function () use (
                $assessment,
                $user,
                $attemptNumber,
                $correct,
                $totalQuestions,
                $score,
                $status,
                $pointsEarned
            ) {

                Log::info('CREATING ASSESSMENT ATTEMPT', [
                    'assessment_id' => $assessment->id,
                    'user_id' => $user->id,
                    'attempt_number' => $attemptNumber,
                    'correct' => $correct,
                    'total' => $totalQuestions,
                    'score' => $score,
                    'status' => $status,
                ]);

                // ------------------------------------------------
                // CREATE ASSESSMENT ATTEMPT
                // ------------------------------------------------

                $attempt = AssessmentAttempt::create([
                    'assessment_id' => $assessment->id,
                    'user_id' => $user->id,
                    'attempt_number' => $attemptNumber,
                    'correct' => $correct,
                    'total' => $totalQuestions,
                    'score' => $score,
                    'status' => $status,
                ]);

                Log::info('ASSESSMENT ATTEMPT CREATED', [
                    'attempt_id' => $attempt->id,
                ]);

                // ------------------------------------------------
                // UPDATE USER GLOBAL PROGRESS
                // ------------------------------------------------

                $user->total_score =
                    ($user->total_score ?? 0)
                    + $pointsEarned;

                $user->questions_answered =
                    ($user->questions_answered ?? 0)
                    + $totalQuestions;

                $user->questions_correct =
                    ($user->questions_correct ?? 0)
                    + $correct;

                // ------------------------------------------------
                // SUCCESS RATE
                // ------------------------------------------------

                $answered =
                    (int) $user->questions_answered;

                $correctTotal =
                    (int) $user->questions_correct;

                $user->success_rate =
                    $answered > 0
                        ? round(
                            ($correctTotal / $answered) * 100,
                            2
                        )
                        : 0;

                // ------------------------------------------------
                // LEVEL
                // ------------------------------------------------

                $user->level = $this->calculateLevel(
                    (int) $user->total_score
                );

                $user->save();

                return $attempt;
            });

        } catch (\Throwable $e) {

            Log::error('ASSESSMENT SUBMISSION FAILED', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'assessment_id' => $assessment->id,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save assessment attempt.',
                'error' => config('app.debug')
                    ? $e->getMessage()
                    : null,
            ], 500);
        }

        // ========================================================
        // PROGRESS
        // ========================================================

        $progress = $this->getProgressData($user);

        // ========================================================
        // RESPONSE
        // ========================================================

        return response()->json([
            'success' => true,

            'data' => [
                'attempt_id' => $attempt->id,
                'attempt_number' => $attemptNumber,

                'correct' => $correct,
                'wrong' => $totalQuestions - $correct,
                'total' => $totalQuestions,

                'score' => $score,

                'passed' => $passed,
                'status' => $status,
                'locked' => $passed,

                'points_earned' => $pointsEarned,

                'progress' => $progress,
            ],
        ]);
    }


    // ============================================================
    // ATTACH ATTEMPT DATA
    // ============================================================

    private function attachAttemptData(
        Assessment $assessment,
        $user
    ): Assessment {

        $totalQuestions = $assessment->questions->count();

        // ========================================================
        // NO QUESTIONS
        // ========================================================

        if ($totalQuestions === 0) {

            $assessment->attempted = false;
            $assessment->correct = 0;
            $assessment->wrong = 0;
            $assessment->total = 0;
            $assessment->score = 0;
            $assessment->status = null;
            $assessment->locked = false;
            $assessment->attempt_number = 0;

            return $assessment;
        }

        // ========================================================
        // LATEST ATTEMPT
        // ========================================================

        $latestAttempt = AssessmentAttempt::query()
            ->where('user_id', $user->id)
            ->where('assessment_id', $assessment->id)
            ->orderByDesc('attempt_number')
            ->first();

        // ========================================================
        // NEVER ATTEMPTED
        // ========================================================

        if (!$latestAttempt) {

            $assessment->attempted = false;
            $assessment->correct = 0;
            $assessment->wrong = 0;
            $assessment->total = $totalQuestions;
            $assessment->score = 0;
            $assessment->status = null;
            $assessment->locked = false;
            $assessment->attempt_number = 0;

            return $assessment;
        }

        // ========================================================
        // ATTEMPT EXISTS
        // ========================================================

        $assessment->attempted = true;

        $assessment->correct =
            (int) $latestAttempt->correct;

        $assessment->wrong =
            max(
                0,
                (int) $latestAttempt->total
                - (int) $latestAttempt->correct
            );

        $assessment->total =
            (int) $latestAttempt->total;

        $assessment->score =
            (float) $latestAttempt->score;

        $assessment->status =
            $latestAttempt->status;

        $assessment->locked =
            $latestAttempt->status === 'passed';

        $assessment->attempt_number =
            (int) $latestAttempt->attempt_number;

        return $assessment;
    }


    // ============================================================
    // LEVEL CALCULATOR
    // ============================================================

    private function calculateLevel(int $score): int
    {
        if ($score >= 1000) {
            return 10;
        }

        if ($score >= 800) {
            return 9;
        }

        if ($score >= 650) {
            return 8;
        }

        if ($score >= 500) {
            return 7;
        }

        if ($score >= 400) {
            return 6;
        }

        if ($score >= 300) {
            return 5;
        }

        if ($score >= 200) {
            return 4;
        }

        if ($score >= 100) {
            return 3;
        }

        if ($score >= 50) {
            return 2;
        }

        return 1;
    }


    // ============================================================
    // PROGRESS DATA
    // ============================================================

    private function getProgressData($user): array
    {
        $score =
            (int) ($user->total_score ?? 0);

        $correct =
            (int) ($user->questions_correct ?? 0);

        $answered =
            (int) ($user->questions_answered ?? 0);

        $wrong =
            max(
                0,
                $answered - $correct
            );

        $successRate =
            (float) ($user->success_rate ?? 0);

        $level =
            (int) ($user->level ?? 1);

        return [
            'score' => $score,
            'correct' => $correct,
            'wrong' => $wrong,
            'totalAnswered' => $answered,
            'successRate' => $successRate,
            'level' => "Level {$level}",
        ];
    }
}
