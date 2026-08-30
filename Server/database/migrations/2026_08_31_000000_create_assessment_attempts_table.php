<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('assessment_attempts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('assessment_id')
                ->constrained('assessments')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->unsignedInteger('attempt_number');

            $table->unsignedInteger('correct')
                ->default(0);

            $table->unsignedInteger('total')
                ->default(0);

            $table->decimal('score', 5, 2)
                ->default(0);

            $table->enum('status', [
                'passed',
                'failed',
            ]);

            $table->timestamps();

            $table->unique(
                ['assessment_id', 'user_id', 'attempt_number'],
                'assessment_attempt_unique'
            );

            $table->index(
                ['assessment_id', 'user_id'],
                'assessment_attempt_lookup'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assessment_attempts');
    }
};