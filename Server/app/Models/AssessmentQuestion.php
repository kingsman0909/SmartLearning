<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentQuestion extends Model
{
    protected $fillable = [
        'assessment_id',
        'question',
        'choice_a',
        'choice_b',
        'choice_c',
        'choice_d',
        'correct_answer',
        'explanation',
        'difficulty',
        'points',
        'question_order',
    ];

    protected $casts = [
        'points' => 'integer',
        'question_order' => 'integer',
    ];

    /**
     * Assessment this question belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(
            Assessment::class
        );
    }
}