<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Lesson;
use App\Models\LessonAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // ============================================================
    // REGISTER
    // ============================================================

    public function register(Request $request)
    {
        $request->validate([
            'alias' => [
                'required',
                'string',
                'max:255',
            ],

            'username' => [
                'required',
                'string',
                'max:100',
                'unique:users,username',
            ],

            'password' => [
                'required',
                'string',
                'min:8',
            ],

            'password_confirmation' => [
                'required',
                'same:password',
            ],
        ]);

        // --------------------------------------------------------
        // STEP 1: CREATE USER
        // --------------------------------------------------------

        $user = User::create([
            'username' => $request->username,
            'alias' => $request->alias,
            'password' => Hash::make(
                $request->password
            ),
        ]);

        // --------------------------------------------------------
        // STEP 2: ASSIGN ALL LESSONS TO THE NEW USER
        // --------------------------------------------------------

        $lessons = Lesson::select('id')->get();

        foreach ($lessons as $lesson) {
            LessonAssignment::create([
                'user_id' => $user->id,
                'lesson_id' => $lesson->id,
                'assigned_at' => now(),
            ]);
        }

        // --------------------------------------------------------
        // STEP 3: CREATE LOGIN TOKEN
        // --------------------------------------------------------

        $token = $user->createToken(
            'probLearn-web'
        )->plainTextToken;

        // --------------------------------------------------------
        // STEP 4: RESPONSE
        // --------------------------------------------------------

        return response()->json([
            'success' => true,

            'message' =>
                'Account created successfully.',

            'token' =>
                $token,

            'user' => [
                'id' =>
                    $user->id,

                'username' =>
                    $user->username,

                'alias' =>
                    $user->alias,

                'role' =>
                    $user->role,

                'level' =>
                    $user->level,

                'total_score' =>
                    $user->total_score ?? 0,

                'questions_answered' =>
                    $user->questions_answered ?? 0,

                'questions_correct' =>
                    $user->questions_correct ?? 0,

                'success_rate' =>
                    $user->success_rate ?? 0,
            ],
        ], 201);
    }


    // ============================================================
    // LOGIN
    // ============================================================

    public function login(Request $request)
    {
        $request->validate([
            'username' => [
                'required',
                'string',
            ],

            'password' => [
                'required',
                'string',
            ],
        ]);

        $user = User::where(
            'username',
            $request->username
        )->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Invalid username or password.',
            ], 401);
        }

        if (!Hash::check(
            $request->password,
            $user->password
        )) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Invalid username or password.',
            ], 401);
        }

        // --------------------------------------------------------
        // REMOVE OLD TOKENS
        // --------------------------------------------------------

        $user->tokens()->delete();

        // --------------------------------------------------------
        // CREATE NEW TOKEN
        // --------------------------------------------------------

        $token = $user->createToken(
            'probLearn-web'
        )->plainTextToken;

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return response()->json([
            'success' => true,

            'message' =>
                'Login successful.',

            'token' =>
                $token,

            'user' => [
                'id' =>
                    $user->id,

                'username' =>
                    $user->username,

                'alias' =>
                    $user->alias,

                'role' =>
                    $user->role,

                'level' =>
                    $user->level,

                'total_score' =>
                    $user->total_score ?? 0,

                'questions_answered' =>
                    $user->questions_answered ?? 0,

                'questions_correct' =>
                    $user->questions_correct ?? 0,

                'success_rate' =>
                    $user->success_rate ?? 0,
            ],
        ]);
    }


    // ============================================================
    // LOGOUT
    // ============================================================

    public function logout(Request $request)
    {
        $request->user()
            ->currentAccessToken()
            ?->delete();

        return response()->json([
            'success' => true,

            'message' =>
                'Logged out successfully.',
        ]);
    }


    // ============================================================
    // CURRENT USER
    // ============================================================

    public function user(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,

            'data' => [
                'id' =>
                    $user->id,

                'username' =>
                    $user->username,

                'alias' =>
                    $user->alias,

                'role' =>
                    $user->role,

                'level' =>
                    $user->level,

                'total_score' =>
                    $user->total_score ?? 0,

                'questions_answered' =>
                    $user->questions_answered ?? 0,

                'questions_correct' =>
                    $user->questions_correct ?? 0,

                'success_rate' =>
                    $user->success_rate ?? 0,
            ],
        ]);
    }
}