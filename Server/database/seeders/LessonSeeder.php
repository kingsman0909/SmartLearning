<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LessonSeeder extends Seeder
{
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | LESSON 1
        |--------------------------------------------------------------------------
        */

        $lessons = [
            [
                'title' => 'Introduction to Probability',
                'description' => 'Learn the fundamental concepts, rules, and applications of probability.',
            ],
            [
                'title' => 'Counting Techniques',
                'description' => 'Learn the fundamental counting principle, permutations, and combinations.',
            ],
        ];

        foreach ($lessons as $lessonData) {

            $lessonId = DB::table('lessons')->insertGetId([
                'title' => $lessonData['title'],
                'description' => $lessonData['description'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            /*
            |--------------------------------------------------------------------------
            | TOPICS
            |--------------------------------------------------------------------------
            */

            if ($lessonData['title'] === 'Introduction to Probability') {

                $topics = [
                    [
                        'name' => 'Basic Probability',
                        'description' => 'Fundamental concepts of probability.',
                    ],
                    [
                        'name' => 'Probability Rules',
                        'description' => 'Basic rules used in solving probability problems.',
                    ],
                    [
                        'name' => 'Events and Outcomes',
                        'description' => 'Understanding events, outcomes, and sample spaces.',
                    ],
                    [
                        'name' => 'Conditional Probability',
                        'description' => 'Introduction to conditional probability.',
                    ],
                    [
                        'name' => 'Independent Events',
                        'description' => 'Understanding independent and dependent events.',
                    ],
                ];

            } else {

                $topics = [
                    [
                        'name' => 'Fundamental Counting Principle',
                        'description' => 'Using the fundamental counting principle.',
                    ],
                    [
                        'name' => 'Factorials',
                        'description' => 'Understanding factorial notation and applications.',
                    ],
                    [
                        'name' => 'Permutations',
                        'description' => 'Arranging objects using permutations.',
                    ],
                    [
                        'name' => 'Combinations',
                        'description' => 'Selecting objects using combinations.',
                    ],
                    [
                        'name' => 'Counting Applications',
                        'description' => 'Applying counting techniques to real-world problems.',
                    ],
                ];
            }

            foreach ($topics as $topicIndex => $topicData) {

                $topicId = DB::table('topics')->insertGetId([
                    'lesson_id' => $lessonId,
                    'name' => $topicData['name'],
                    'description' => $topicData['description'],
                    'topic_order' => $topicIndex + 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                /*
                |--------------------------------------------------------------------------
                | QUESTIONS
                |--------------------------------------------------------------------------
                */

                $questions = [];

                for ($i = 1; $i <= 5; $i++) {

                    $questions[] = [
                        'topic_id' => $topicId,
                        'question' => "Sample question {$i} for {$topicData['name']}?",
                        'choice_a' => 'Option A',
                        'choice_b' => 'Option B',
                        'choice_c' => 'Option C',
                        'choice_d' => 'Option D',
                        'correct_answer' => ['A', 'B', 'C', 'D'][($i - 1) % 4],
                        'explanation' => "Explanation for question {$i}.",
                        'difficulty' => match ($i) {
                            1, 2 => 'easy',
                            3, 4 => 'medium',
                            default => 'hard',
                        },
                        'points' => 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                DB::table('questions')->insert($questions);

                /*
                |--------------------------------------------------------------------------
                | GET QUESTIONS FOR THIS TOPIC
                |--------------------------------------------------------------------------
                */

                $questionIds = DB::table('questions')
                    ->where('topic_id', $topicId)
                    ->orderBy('id')
                    ->pluck('id');

                /*
                |--------------------------------------------------------------------------
                | ASSESSMENT
                |--------------------------------------------------------------------------
                */

                $assessmentId = DB::table('assessments')->insertGetId([
                    'topic_id' => $topicId,
                    'title' => "{$topicData['name']} Assessment",
                    'description' => "Assessment covering {$topicData['name']}.",
                    'total_questions' => 5,
                    'total_points' => 5,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                /*
                |--------------------------------------------------------------------------
                | ASSESSMENT QUESTIONS
                |--------------------------------------------------------------------------
                */

                foreach ($questionIds as $index => $questionId) {

                    DB::table('assessment_questions')->insert([
                        'assessment_id' => $assessmentId,
                        'question_id' => $questionId,
                        'question_order' => $index + 1,
                    ]);
                }
            }
        }
    }
}
