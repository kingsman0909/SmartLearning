<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assessment extends Model
{
    protected $fillable = [
        'title',
        'description',
        'difficulty',
        'icon',
        'topic_id',
    ];

    public function topic(): BelongsTo
    {
        return $this->belongsTo(
            Topic::class
        );
    }

    public function questions(): HasMany
    {
        return $this->hasMany(
            AssessmentQuestion::class
        )->orderBy('question_order');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(
            AssessmentAttempt::class
        );
    }
}