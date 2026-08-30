<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentAttempt extends Model
{
    protected $fillable = [
        'assessment_id',
        'user_id',
        'attempt_number',
        'correct',
        'total',
        'score',
        'status',
    ];

    protected $casts = [
        'attempt_number' => 'integer',
        'correct' => 'integer',
        'total' => 'integer',
        'score' => 'decimal:2',
    ];

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}