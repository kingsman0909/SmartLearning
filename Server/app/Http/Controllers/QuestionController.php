<?php

namespace App\Http\Controllers;

use App\Models\Question;
use App\Models\QuestionAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class QuestionController extends Controller
{
    // ============================================================
    // ALL QUESTIONS
    // ============================================================

    public function index(Request $request): JsonResponse
    {
        $query = Question::query()
            ->select([
                'id',
                'topic_id',
                'question',
                'choice_a',
                'choice_b',
                'choice_c',
                'choice_d',
                'difficulty',
                'points',
                'explanation',
            ]);

        if ($request->filled('topic_id')) {
            $query->where(
                'topic_id',
                $request->integer('topic_id')
            );
        }

        if ($request->filled('difficulty')) {
            $query->where(
                'difficulty',
                $request->string('difficulty')
            );
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }


    // ============================================================
    // SINGLE QUESTION
    // ============================================================

    public function show(int $id): JsonResponse
    {
        $question = Question::query()
            ->select([
                'id',
                'topic_id',
                'question',
                'choice_a',
                'choice_b',
                'choice_c',
                'choice_d',
                'difficulty',
                'points',
                'explanation',
            ])
            ->find($id);

        if (!$question) {
            return response()->json([
                'success' => false,
                'message' => 'Question not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $question,
        ]);
    }


    // ============================================================
    // PRACTICE QUESTIONS
    // ============================================================

    public function practice(Request $request): JsonResponse
    {
        $query = Question::query()
            ->select([
                'id',
                'topic_id',
                'question',
                'choice_a',
                'choice_b',
                'choice_c',
                'choice_d',
                'difficulty',
                'explanation',
                'points',
            ]);

        if ($request->filled('topic_id')) {
            $query->where(
                'topic_id',
                $request->integer('topic_id')
            );
        }

        if ($request->filled('difficulty')) {
            $query->where(
                'difficulty',
                $request->string('difficulty')
            );
        }

        $questions = $query->get()->map(function ($question) {
            return [
                'id' => $question->id,
                'topic_id' => $question->topic_id,
                'question' => $question->question,

                'options' => [
                    $question->choice_a,
                    $question->choice_b,
                    $question->choice_c,
                    $question->choice_d,
                ],

                'difficulty' => $question->difficulty,
                'points' => $question->points,
                'explanation' => $question->explanation,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $questions,
        ]);
    }


    // ============================================================
    // FLASHCARDS
    // ============================================================

    public function flashcards(Request $request): JsonResponse
    {
        $questions = Question::query()
            ->select([
                'id',
                'topic_id',
                'question',
                'choice_a',
                'choice_b',
                'choice_c',
                'choice_d',
                'difficulty',
                'explanation',
                'points',
            ])
            ->when(
                $request->filled('topic_id'),
                function ($query) use ($request) {
                    $query->where(
                        'topic_id',
                        $request->integer('topic_id')
                    );
                }
            )
            ->get()
            ->map(function ($question) {
                return [
                    'id' => $question->id,
                    'topic_id' => $question->topic_id,

                    'question' => $question->question,

                    'options' => [
                        $question->choice_a,
                        $question->choice_b,
                        $question->choice_c,
                        $question->choice_d,
                    ],

                    'difficulty' => $question->difficulty,
                    'points' => $question->points,
                    'explanation' => $question->explanation,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $questions,
        ]);
    }


    // ============================================================
// PRACTICE ANSWER
// ============================================================

public function practiceAnswer(Request $request): JsonResponse
{
    $request->validate([
        'question_id' => ['required', 'integer'],
        'answer' => ['required', 'in:A,B,C,D'],
    ]);

    $question = Question::find(
        $request->integer('question_id')
    );

    if (!$question) {
        return response()->json([
            'success' => false,
            'message' => 'Question not found.',
        ], 404);
    }

    $selectedAnswer = strtoupper(
        $request->input('answer')
    );

    $isCorrect =
        $selectedAnswer ===
        strtoupper($question->correct_answer);

    // Practice gets the FULL question points
    $scoreEarned = $isCorrect
        ? (int) $question->points
        : 0;

    $user = Auth::user();

    if ($user) {
        QuestionAttempt::create([
            'user_id' => $user->id,
            'question_id' => $question->id,
            'selected_answer' => $selectedAnswer,
            'is_correct' => $isCorrect,
            'score_earned' => $scoreEarned,
        ]);

        $this->updateUserProgress(
            $user,
            $isCorrect,
            $scoreEarned
        );
    }

    return response()->json([
        'success' => true,

        'data' => [
            'correct' => $isCorrect,

            'selected_answer' =>
                $selectedAnswer,

            'correct_answer' =>
                strtoupper($question->correct_answer),

            'correct_answer_text' =>
                $this->getAnswerText($question),

            'score_earned' =>
                $scoreEarned,

            // Alias para compatible sa frontend
            'points_earned' =>
                $scoreEarned,

            'explanation' =>
                $question->explanation,

            'progress' =>
                $this->getProgressData($user),
        ],
    ]);
}


   // ============================================================
// FLASHCARD ANSWER
// ============================================================

public function flashcardAnswer(Request $request): JsonResponse
{
    $request->validate([
        'question_id' => ['required', 'integer'],
        'answer' => ['required', 'in:A,B,C,D'],
    ]);

    $question = Question::find(
        $request->integer('question_id')
    );

    if (!$question) {
        return response()->json([
            'success' => false,
            'message' => 'Question not found.',
        ], 404);
    }

    $selectedAnswer = strtoupper(
        $request->input('answer')
    );

    $isCorrect =
        $selectedAnswer ===
        strtoupper($question->correct_answer);

    // ========================================================
    // FLASHCARD HAS LOWER REWARD
    // ========================================================

    $flashcardPoints = match (
        strtolower($question->difficulty ?? 'medium')
    ) {
        'easy' => 2,
        'medium' => 4,
        'hard' => 6,
        default => 4,
    };

    $scoreEarned = $isCorrect
        ? $flashcardPoints
        : 0;

    $user = Auth::user();

    if ($user) {
        QuestionAttempt::create([
            'user_id' => $user->id,
            'question_id' => $question->id,
            'selected_answer' => $selectedAnswer,
            'is_correct' => $isCorrect,
            'score_earned' => $scoreEarned,
        ]);

        $this->updateUserProgress(
            $user,
            $isCorrect,
            $scoreEarned
        );
    }

    return response()->json([
        'success' => true,

        'data' => [
            'correct' => $isCorrect,

            'selected_answer' =>
                $selectedAnswer,

            // ALWAYS RETURN THE CORRECT ANSWER
            'correct_answer' =>
                strtoupper($question->correct_answer),

            'correct_answer_text' =>
                $this->getAnswerText($question),

            'score_earned' =>
                $scoreEarned,

            // Frontend compatibility
            'points_earned' =>
                $scoreEarned,

            'explanation' =>
                $question->explanation,

            'progress' =>
                $this->getProgressData($user),
        ],
    ]);
}

    // ============================================================
    // UPDATE USER PROGRESS
    // ============================================================

    private function updateUserProgress(
        $user,
        bool $isCorrect,
        int $scoreEarned
    ): void {
        $user->total_score =
            ($user->total_score ?? 0)
            + $scoreEarned;

        $user->questions_answered =
            ($user->questions_answered ?? 0)
            + 1;

        if ($isCorrect) {
            $user->questions_correct =
                ($user->questions_correct ?? 0)
                + 1;
        }

        $answered =
            $user->questions_answered;

        $correct =
            $user->questions_correct;

        $user->success_rate =
            $answered > 0
                ? round(
                    ($correct / $answered) * 100,
                    2
                )
                : 0;

        $user->save();
    }


    // ============================================================
    // PROGRESS DATA
    // ============================================================

    private function getProgressData($user): array
    {
        if (!$user) {
            return [
                'score' => 0,
                'correct' => 0,
                'wrong' => 0,
                'totalAnswered' => 0,
                'successRate' => 0,
                'level' => 'Beginner',
            ];
        }

        $score =
            (int) ($user->total_score ?? 0);

        $correct =
            (int) ($user->questions_correct ?? 0);

        $answered =
            (int) ($user->questions_answered ?? 0);

        $wrong =
            max(0, $answered - $correct);

        $successRate =
            (float) ($user->success_rate ?? 0);

        // ========================================================
        // LEVEL SYSTEM
        // ========================================================

        if ($score >= 1000) {
            $level = 'Level 10';
        } elseif ($score >= 800) {
            $level = 'Level 9';
        } elseif ($score >= 650) {
            $level = 'Level 8';
        } elseif ($score >= 500) {
            $level = 'Level 7';
        } elseif ($score >= 400) {
            $level = 'Level 6';
        } elseif ($score >= 300) {
            $level = 'Level 5';
        } elseif ($score >= 200) {
            $level = 'Level 4';
        } elseif ($score >= 100) {
            $level = 'Level 3';
        } elseif ($score >= 50) {
            $level = 'Level 2';
        } else {
            $level = 'Level 1';
        }

        return [
            'score' => $score,
            'correct' => $correct,
            'wrong' => $wrong,
            'totalAnswered' => $answered,
            'successRate' => $successRate,
            'level' => $level,
        ];


        
    }
    // ============================================================
// GET CORRECT ANSWER TEXT
// ============================================================

private function getAnswerText(Question $question): string
{
    return match (
        strtoupper($question->correct_answer)
    ) {
        'A' => $question->choice_a,
        'B' => $question->choice_b,
        'C' => $question->choice_c,
        'D' => $question->choice_d,
        default => '',
    };
}
}
