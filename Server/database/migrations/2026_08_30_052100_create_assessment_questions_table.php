<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessment_questions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('assessment_id')
                ->constrained('assessments')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->foreignId('question_id')
                ->constrained('questions')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->unsignedInteger('question_order')->default(1);

            $table->timestamps();

            $table->unique(
                ['assessment_id', 'question_id'],
                'assessment_question_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_questions');
    }
};
