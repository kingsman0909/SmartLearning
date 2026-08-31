<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GeminiTestController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TopicController;
use App\Http\Controllers\QuestionController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\AiLessonController;
use App\Http\Controllers\LessonController;


// ============================================================
// PUBLIC
// ============================================================

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get(
    '/gemini/test',
    [GeminiTestController::class, 'test']
);
// ============================================================
// TOPICS
// ============================================================

Route::get('/topics', [TopicController::class, 'index']);
Route::get('/topics/{topic}', [TopicController::class, 'show']);


// ============================================================
// QUESTIONS
// ============================================================

Route::get(
    '/questions/practice',
    [QuestionController::class, 'practice']
);

Route::get(
    '/questions/flashcards',
    [QuestionController::class, 'flashcards']
);


// ============================================================
// AUTHENTICATED
// ============================================================

Route::middleware('auth:sanctum')->group(function () {

    // ========================================================
    // USER
    // ========================================================

    Route::get('/user', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'user' => $request->user(),
        ]);
    });


    Route::post(
        '/ai/generate-lesson',
        [AiLessonController::class, 'generateLesson']
    );

    Route::post(
        '/ai/generate-topic-questions',
        [AiLessonController::class, 'generateTopicQuestions']
    );


    // ========================================================
    // LOGOUT
    // ========================================================

    Route::post(
        '/logout',
        [AuthController::class, 'logout']
    );


    // ========================================================
    // LESSONS
    // ========================================================

    // Get all lessons assigned to authenticated user
    Route::get(
        '/lessons',
        [LessonController::class, 'index']
    );

    // Get one assigned lesson
    Route::get(
        '/lessons/{lesson}',
        [LessonController::class, 'show']
    );


    // ========================================================
    // PRACTICE
    // ========================================================

    Route::post(
        '/practice/answer',
        [QuestionController::class, 'practiceAnswer']
    );


    // ========================================================
    // FLASHCARDS
    // ========================================================

    Route::post(
        '/flashcards/answer',
        [QuestionController::class, 'flashcardAnswer']
    );


    // ========================================================
    // ASSESSMENTS
    // ========================================================

    // Get assessments
    Route::get(
        '/assessments',
        [AssessmentController::class, 'index']
    );

    // Get one assessment
    Route::get(
        '/assessments/{assessment}',
        [AssessmentController::class, 'show']
    );

    // Submit assessment
    Route::post(
        '/assessments/{assessment}/submit',
        [AssessmentController::class, 'submit']
    );


    // ========================================================
    // PROGRESS
    // ========================================================

    Route::get(
        '/progress',
        [ProgressController::class, 'index']
    );

    Route::get(
        '/score',
        [ProgressController::class, 'score']
    );
});