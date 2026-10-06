
<?php

namespace App\Http\Controllers;

use App\Models\Topic;
use Illuminate\Http\JsonResponse;

class TopicController extends Controller
{
    /**
     * Get all topics.
     *
     * Does NOT load the large topic content.
     */
    public function index(): JsonResponse
    {
        $topics = Topic::query()
            ->orderBy('lesson_id')
            ->orderBy('topic_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $topics,
        ]);
    }

    /**
     * Get one topic with its learning content.
     */
    public function show(int $id): JsonResponse
    {
        $topic = Topic::query()
            ->with('content')
            ->find($id);

        if (!$topic) {
            return response()->json([
                'success' => false,
                'message' => 'Topic not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $topic,
        ]);
    }
}
