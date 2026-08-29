<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_question_progress', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->foreignId('question_id')
                ->constrained('questions')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->enum('type', [
                'practice',
                'flashcard'
            ]);

            $table->string('selected_answer', 1)->nullable();

            $table->boolean('is_correct')->default(false);

            $table->unsignedInteger('points_earned')->default(0);

            $table->timestamp('answered_at')->nullable();

            $table->timestamps();

            $table->unique(
                ['user_id', 'question_id', 'type'],
                'unique_user_question_type'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_question_progress');
    }
};
