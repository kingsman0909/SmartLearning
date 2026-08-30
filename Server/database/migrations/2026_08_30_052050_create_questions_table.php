<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('topic_id')
                ->constrained('topics')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->text('question');

            $table->string('choice_a', 500);
            $table->string('choice_b', 500);
            $table->string('choice_c', 500);
            $table->string('choice_d', 500);

            $table->enum('correct_answer', ['A', 'B', 'C', 'D']);

            $table->text('explanation')->nullable();

            $table->enum('difficulty', [
                'easy',
                'medium',
                'hard'
            ])->default('easy');

            $table->unsignedInteger('points')->default(1);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
