<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionAttempt extends Model
{
    use HasFactory;

    protected $table = 'question_attempts';

    protected $fillable = [
        'user_id',
        'question_id',
        'selected_answer',
        'is_correct',
        'score_earned',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'question_id' => 'integer',
        'is_correct' => 'boolean',
        'score_earned' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function question()
    {
        return $this->belongsTo(Question::class);
    }
}