<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProgressController extends Controller
{
    public function index(
        Request $request
    ): JsonResponse {

        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        return response()->json([
            'success' => true,

            'data' => [
                'score' =>
                    (int) ($user->total_score ?? 0),

                'correct' =>
                    (int) ($user->questions_correct ?? 0),

                'wrong' =>
                    max(
                        0,
                        (int) ($user->questions_answered ?? 0)
                        -
                        (int) ($user->questions_correct ?? 0)
                    ),

                'totalAnswered' =>
                    (int) ($user->questions_answered ?? 0),

                'successRate' =>
                    (float) ($user->success_rate ?? 0),

                'level' =>
                    'Level ' .
                    (int) ($user->level ?? 1),
            ],
        ]);
    }


    public function score(
        Request $request
    ): JsonResponse {

        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        return response()->json([
            'success' => true,

            'data' => [
                'score' =>
                    (int) ($user->total_score ?? 0),

                'level' =>
                    'Level ' .
                    (int) ($user->level ?? 1),
            ],
        ]);
    }
}