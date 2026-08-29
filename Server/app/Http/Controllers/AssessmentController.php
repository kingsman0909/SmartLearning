<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\QuestionAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AssessmentController extends Controller
{
    // ============================================================
    // ASSESSMENTS
    // ============================================================

    public function index(): JsonResponse
    {
        $assessments = Assessment::query()
            ->with([
                'questions:id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation'
            ])
            ->get();

        return response()->json([
            'success' => true,
            'data' => $assessments,
        ]);
    }


    // ============================================================
    // SINGLE ASSESSMENT
    // ============================================================

    public function show(
        Assessment $assessment
    ): JsonResponse {

        $assessment->load([
            'questions:id,question,choice_a,choice_b,choice_c,choice_d,correct_answer,difficulty,points,explanation'
        ]);

        return response()->json([
            'success' => true,
            'data' => $assessment,
        ]);
    }


    // ============================================================
    // SUBMIT ASSESSMENT
    // ============================================================

    // ============================================================
// SUBMIT ASSESSMENT
// ============================================================

public function submit(
    Request $request,
    Assessment $assessment
): JsonResponse {

    $request->validate([
        'answers' => ['required', 'array'],
        'answers.*.question_id' => [
            'required',
            'integer',
        ],
        'answers.*.answer' => [
            'required',
            'in:A,B,C,D',
        ],
    ]);

    $user = Auth::user();

    if (!$user) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated.',
        ], 401);
    }

    // --------------------------------------------------------
    // LOAD QUESTIONS
    // --------------------------------------------------------

    $assessment->load([
        'questions:id,question,choice_a,choice_b,choice_c,choice_d,difficulty,points,explanation,correct_answer'
    ]);

    $questions = $assessment->questions;

    if ($questions->isEmpty()) {
        return response()->json([
            'success' => false,
            'message' => 'This assessment has no questions.',
        ], 400);
    }

    // --------------------------------------------------------
    // ANSWERS FROM FRONTEND
    // --------------------------------------------------------

    $submittedAnswers = collect(
        $request->input('answers')
    )->keyBy('question_id');

    // --------------------------------------------------------
    // CHECK ANSWERS
    // --------------------------------------------------------

    $correct = 0;
    $total = $questions->count();

    foreach ($questions as $question) {

        $submitted = $submittedAnswers->get(
            $question->id
        );

        $selectedAnswer = strtoupper(
            $submitted['answer'] ?? ''
        );

        $correctAnswer = strtoupper(
            trim($question->correct_answer ?? '')
        );

        $isCorrect =
            $selectedAnswer === $correctAnswer;

        if ($isCorrect) {
            $correct++;
        }
    }

    // --------------------------------------------------------
    // CALCULATE SCORE
    // --------------------------------------------------------

    $score = $total > 0
        ? round(
            ($correct / $total) * 100,
            2
        )
        : 0;

    // --------------------------------------------------------
    // PASSING RULE
    //
    // 6/10 = 60% = PASS
    // 5/10 = 50% = FAIL
    // --------------------------------------------------------

    $passed = $correct >= 6;

    // --------------------------------------------------------
    // POINTS
    //
    // FAILED = 0 points
    // PASSED = number of correct answers
    //
    // Example:
    // 3/10 -> 0 points
    // 6/10 -> 6 points
    // 10/10 -> 10 points
    // --------------------------------------------------------

    $pointsEarned = $passed
        ? $correct
        : 0;

    // --------------------------------------------------------
    // SAVE QUESTION ATTEMPTS
    // --------------------------------------------------------

    foreach ($questions as $question) {

        $submitted = $submittedAnswers->get(
            $question->id
        );

        $selectedAnswer = strtoupper(
            $submitted['answer'] ?? ''
        );

        $correctAnswer = strtoupper(
            trim($question->correct_answer ?? '')
        );

        $isCorrect =
            $selectedAnswer === $correctAnswer;

        QuestionAttempt::create([
            'user_id' => $user->id,

            'question_id' =>
                $question->id,

            'selected_answer' =>
                $selectedAnswer,

            'is_correct' =>
                $isCorrect,

            // IMPORTANT:
            // Assessment gives points ONLY if passed.
            'score_earned' =>
                $passed && $isCorrect
                    ? 1
                    : 0,
        ]);
    }

    // --------------------------------------------------------
    // UPDATE USER PROGRESS
    //
    // IMPORTANT:
    // Failed assessment:
    //   +0 points
    //
    // Passed assessment:
    //   +correct points
    // --------------------------------------------------------

    $wrong = $total - $correct;

    $user->total_score =
        ($user->total_score ?? 0)
        + $pointsEarned;

    $user->questions_answered =
        ($user->questions_answered ?? 0)
        + $total;

    $user->questions_correct =
        ($user->questions_correct ?? 0)
        + $correct;

    $answered =
        $user->questions_answered;

    $correctTotal =
        $user->questions_correct;

    $user->success_rate =
        $answered > 0
            ? round(
                ($correctTotal / $answered) * 100,
                2
            )
            : 0;

    // --------------------------------------------------------
    // LEVEL
    // --------------------------------------------------------

    $user->level =
        $this->calculateLevel(
            (int) $user->total_score
        );

    $user->save();

    // --------------------------------------------------------
    // PROGRESS
    // --------------------------------------------------------

    $progress =
        $this->getProgressData(
            $user
        );

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return response()->json([
        'success' => true,

        'data' => [

            'correct' =>
                $correct,

            'wrong' =>
                $wrong,

            'total' =>
                $total,

            'score' =>
                $score,

            'passed' =>
                $passed,

            'status' =>
                $passed
                    ? 'passed'
                    : 'failed',

            'points_earned' =>
                $pointsEarned,

            'progress' =>
                $progress,
        ],
    ]);
}

    // ============================================================
    // LEVEL
    // ============================================================

    private function calculateLevel(
        int $score
    ): int {

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

    private function getProgressData(
        $user
    ): array {

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
            'score' =>
                $score,

            'correct' =>
                $correct,

            'wrong' =>
                $wrong,

            'totalAnswered' =>
                $answered,

            'successRate' =>
                $successRate,

            'level' =>
                "Level {$level}",
        ];
    }
}