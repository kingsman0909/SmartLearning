<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assessment extends Model
{
    protected $fillable = [
        'topic_id',
        'title',
        'description',
        'total_questions',
        'total_points',
    ];

    protected $casts = [
        'topic_id' => 'integer',
        'total_questions' => 'integer',
        'total_points' => 'integer',
    ];

    // ============================================================
    // TOPIC
    // ============================================================

    public function topic(): BelongsTo
    {
        return $this->belongsTo(
            Topic::class
        );
    }

    // ============================================================
    // QUESTIONS
    // ============================================================
    //
    // assessment_questions is a pivot table:
    //
    // assessment_id
    // question_id
    // question_order
    //
    // This relationship returns actual Question models.
    //

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(
            Question::class,
            'assessment_questions',
            'assessment_id',
            'question_id'
        )
            ->withPivot('question_order')
            ->orderBy('assessment_questions.question_order');
    }

    // ============================================================
    // ATTEMPTS
    // ============================================================

    public function attempts(): HasMany
    {
        return $this->hasMany(
            AssessmentAttempt::class
        );
    }
}