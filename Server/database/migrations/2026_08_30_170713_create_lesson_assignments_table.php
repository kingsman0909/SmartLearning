<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lesson_assignments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->foreignId('lesson_id')
                ->constrained('lessons')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->timestamp('assigned_at')->useCurrent();

            $table->timestamps();

            $table->unique(
                ['user_id', 'lesson_id'],
                'lesson_assignments_user_lesson_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_assignments');
    }
};
