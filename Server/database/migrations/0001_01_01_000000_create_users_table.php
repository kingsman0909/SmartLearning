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
    Schema::create('users', function (Blueprint $table) {
        $table->id();

        $table->string('username', 100)->unique();
        $table->string('alias');

        $table->enum('role', [
            'student',
            'professor',
            'admin'
        ])->default('student');

        $table->unsignedInteger('level')->default(1);
        $table->unsignedInteger('total_score')->default(0);
        $table->unsignedInteger('questions_answered')->default(0);
        $table->unsignedInteger('questions_correct')->default(0);

        $table->decimal('success_rate', 5, 2)
            ->unsigned()
            ->default(0);

        $table->string('password');

        $table->timestamps();
    });
}
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
