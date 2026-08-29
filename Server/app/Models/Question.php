<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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

    public function topic()
    {
        return $this->belongsTo(Topic::class);
    }
}