<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopicContent extends Model
{
    use HasFactory;

    protected $table = 'topic_contents';

    protected $fillable = [
        'topic_id',
        'content',
    ];

    protected $casts = [
        'topic_id' => 'integer',
    ];

    public function topic(): BelongsTo
    {
        return $this->belongsTo(
            Topic::class
        );
    }
}