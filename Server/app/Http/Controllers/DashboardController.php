<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'score' => 0,
                'success_rate' => 0,
                'topics_completed' => 0,
                'questions_answered' => 0,
                'questions_correct' => 0,
                'assessments_completed' => 0,
            ],
        ]);
    }
}