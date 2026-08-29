<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Assessment extends Model
{
    protected $fillable = [
        'title',
        'description',
        'difficulty',
        'icon',
    ];

    public function questions(): BelongsToMany
{
    return $this->belongsToMany(
        Question::class,
        'assessment_questions'
    )
    ->withPivot('question_order')
    ->orderBy('assessment_questions.question_order');
}
}