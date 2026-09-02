<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Question extends Model
{
    use HasFactory;

    protected $table = 'questions';

    protected $fillable = [
        'topic_id',
        'question',
        'choice_a',
        'choice_b',
        'choice_c',
        'choice_d',
        'correct_answer',
        'explanation',
        'difficulty',
        'points',
    ];

    protected $casts = [
        'topic_id' => 'integer',
        'points' => 'integer',
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
    // ASSESSMENTS
    // ============================================================

    public function assessments(): BelongsToMany
    {
        return $this->belongsToMany(
            Assessment::class,
            'assessment_questions',
            'question_id',
            'assessment_id'
        )
            ->withPivot('question_order');
    }
}