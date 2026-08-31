<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    /**
     * Get lessons assigned to the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.'
            ], 401);
        }

        $lessons = Lesson::query()
            ->whereHas('assignments', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            ->with([
                'topics' => function ($query) {
                    $query->orderBy('topic_order');
                },
                'topics.assessments'
            ])
            ->orderBy('lesson_order')
            ->get();

        return response()->json([
            'lessons' => $lessons
        ]);
    }

    /**
     * Get one assigned lesson.
     */
    public function show(Request $request, Lesson $lesson)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.'
            ], 401);
        }

        $isAssigned = $lesson->assignments()
            ->where('user_id', $user->id)
            ->exists();

        if (!$isAssigned) {
            return response()->json([
                'message' => 'Lesson not assigned to this user.'
            ], 403);
        }

        $lesson->load([
            'topics' => function ($query) {
                $query->orderBy('topic_order');
            },
            'topics.assessments'
        ]);

        return response()->json([
            'lesson' => $lesson
        ]);
    }
}

