<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'username',
    'password',
    'alias',
    'role',
    'level',
    'total_score',
    'questions_answered',
    'questions_correct',
    'success_rate',
])]

#[Hidden([
    'password',
])]
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'level' => 'integer',
            'total_score' => 'integer',
            'questions_answered' => 'integer',
            'questions_correct' => 'integer',
            'success_rate' => 'decimal:2',
        ];
    }
}