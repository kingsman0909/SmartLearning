<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class LessonAssignment extends Model
{
    protected $fillable = [
        'user_id',
        'lesson_id',
        'assigned_at',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    /**
     * Assign all existing lessons to a user.
     */
    public static function assignAllLessonsToUser(int $userId): void
    {
        $lessons = Lesson::select('id')->get();

        $assignments = $lessons->map(function ($lesson) use ($userId) {
            return [
                'user_id' => $userId,
                'lesson_id' => $lesson->id,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        })->toArray();

        if (!empty($assignments)) {
            self::insert($assignments);
        }
    }
}