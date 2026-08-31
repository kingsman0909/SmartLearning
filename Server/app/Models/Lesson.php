<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Lesson extends Model
{
    protected $fillable = [
        'title',
        'description',
        'lesson_order',
    ];

    public function topics(): HasMany
    {
        return $this->hasMany(Topic::class)
            ->orderBy('topic_order');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LessonAssignment::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'lesson_assignments'
        )->withTimestamps();
    }
}