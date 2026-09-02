<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Topic extends Model
{
    use HasFactory;

    protected $table = 'topics';

    protected $fillable = [
        'lesson_id',
        'name',
        'description',
        'topic_order',
    ];

    protected $casts = [
        'lesson_id' => 'integer',
        'topic_order' => 'integer',
    ];

    // ============================================================
    // LESSON
    // ============================================================

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(
            Lesson::class
        );
    }

    // ============================================================
    // QUESTIONS
    // ============================================================

    public function questions(): HasMany
    {
        return $this->hasMany(
            Question::class
        );
    }

    // ============================================================
    // ASSESSMENTS
    // ============================================================

    public function assessments(): HasMany
    {
        return $this->hasMany(
            Assessment::class
        );
    }
}