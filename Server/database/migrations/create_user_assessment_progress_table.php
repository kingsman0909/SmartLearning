
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_assessment_progress', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->foreignId('assessment_id')
                ->constrained('assessments')
                ->cascadeOnDelete()
                ->cascadeOnUpdate();

            $table->enum('status', [
                'locked',
                'unlocked',
                'in_progress',
                'passed',
                'failed'
            ])->default('locked');

            $table->decimal('score', 5, 2)->nullable();

            $table->unsignedInteger('correct')->default(0);
            $table->unsignedInteger('total')->default(0);
            $table->unsignedInteger('points_earned')->default(0);

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();

            $table->unique(
                ['user_id', 'assessment_id'],
                'unique_user_assessment'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_assessment_progress');
    }
};
