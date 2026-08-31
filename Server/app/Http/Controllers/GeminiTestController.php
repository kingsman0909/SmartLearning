<?php

namespace App\Http\Controllers;

use App\Services\GeminiService;
use Illuminate\Http\JsonResponse;

class GeminiTestController extends Controller
{
    public function test(
        GeminiService $gemini
    ): JsonResponse {

        try {

            $result = $gemini->generateJson(
                <<<PROMPT
You are an educational assistant for an LMS called ProbLearn.

Generate a very small sample lesson about:
"Introduction to Computer Networks"

Return ONLY valid JSON using exactly this structure:

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

Create exactly 3 topics.

Do not include markdown.
Do not include ```json.
PROMPT
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);

        } catch (\Throwable $e) {

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}