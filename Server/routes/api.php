<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TopicController;
use App\Http\Controllers\QuestionController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\ProgressController;
// ============================================================
// PUBLIC
// ============================================================

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/topics', [TopicController::class, 'index']);
Route::get('/topics/{topic}', [TopicController::class, 'show']);

Route::get('/questions/practice', [QuestionController::class, 'practice']);
Route::get('/questions/flashcards', [QuestionController::class, 'flashcards']);


// ============================================================
// AUTHENTICATED
// ============================================================

Route::middleware('auth:sanctum')->group(function () {

    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

    Route::get('/user', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'user' => $request->user(),
        ]);
    });

    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    Route::post('/logout', [AuthController::class, 'logout']);

    // --------------------------------------------------------
    // PRACTICE
    // --------------------------------------------------------

    Route::post(
        '/practice/answer',
        [QuestionController::class, 'practiceAnswer']
    );

    // --------------------------------------------------------
    // FLASHCARDS
    // --------------------------------------------------------

    Route::post(
        '/flashcards/answer',
        [QuestionController::class, 'flashcardAnswer']
    );

    // --------------------------------------------------------
    // ASSESSMENTS
    // --------------------------------------------------------

    Route::get(
        '/assessments',
        [AssessmentController::class, 'index']
    );

    Route::get(
        '/assessments/{assessment}',
        [AssessmentController::class, 'show']
    );

    Route::post(
        '/assessments/{assessment}/submit',
        [AssessmentController::class, 'submit']
    );

    // --------------------------------------------------------
    // PROGRESS
    // --------------------------------------------------------

    Route::get(
        '/progress',
        [ProgressController::class, 'index']
    );

    Route::get(
        '/score',
        [ProgressController::class, 'score']
    );
});