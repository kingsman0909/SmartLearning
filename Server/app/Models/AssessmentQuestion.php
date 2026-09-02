<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentQuestion extends Model
{
    protected $table = 'assessment_questions';

    protected $fillable = [
        'assessment_id',
        'question_id',
        'question_order',
    ];

    protected $casts = [
        'assessment_id' => 'integer',
        'question_id' => 'integer',
        'question_order' => 'integer',
    ];

    // ============================================================
    // ASSESSMENT
    // ============================================================

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(
            Assessment::class
        );
    }

    // ============================================================
    // QUESTION
    // ============================================================

    public function question(): BelongsTo
    {
        return $this->belongsTo(
            Question::class
        );
    }
}