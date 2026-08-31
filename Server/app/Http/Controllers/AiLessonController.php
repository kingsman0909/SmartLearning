<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\Question;
use App\Models\Topic;
use App\Services\GeminiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser;

class AiLessonController extends Controller
{
    /**
     * ============================================================
     * STAGE 1
     *
     * PDF -> Gemini -> Lesson + Topics
     *
     * This stage ONLY creates:
     * - Lesson
     * - Topics
     *
     * Questions are generated in Stage 2.
     * ============================================================
     */
    public function generateLesson(
        Request $request,
        GeminiService $gemini
    ) {
        set_time_limit(300);

        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:20480',
                'mimes:pdf',
            ],

            'lesson_title' => [
                'nullable',
                'string',
                'max:150',
            ],

            'easy_questions' => [
                'required',
                'integer',
                'min:0',
            ],

            'medium_questions' => [
                'required',
                'integer',
                'min:0',
            ],

            'hard_questions' => [
                'required',
                'integer',
                'min:0',
            ],
        ]);

        $file = $request->file('file');

        $userLessonTitle = $validated['lesson_title'] ?? null;

        $easyCount = (int) $validated['easy_questions'];
        $mediumCount = (int) $validated['medium_questions'];
        $hardCount = (int) $validated['hard_questions'];

        try {

            /**
             * ========================================================
             * EXTRACT PDF TEXT
             * ========================================================
             */
            $parser = new Parser();

            $pdf = $parser->parseFile(
                $file->getRealPath()
            );

            $content = $pdf->getText();

            if (trim($content) === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'The PDF contains no readable text.',
                ], 422);
            }

            /**
             * ========================================================
             * CLEAN PDF TEXT
             * ========================================================
             */
            $content = preg_replace(
                '/\s+/',
                ' ',
                $content
            );

            /**
             * Prevent an excessively large Gemini request.
             */
            $content = mb_substr(
                $content,
                0,
                30000
            );

            /**
             * ========================================================
             * TITLE INSTRUCTION
             * ========================================================
             */
            $titleInstruction = $userLessonTitle
                ? "Use this suggested title as guidance: {$userLessonTitle}"
                : "Generate an appropriate lesson title from the learning material.";

            /**
             * ========================================================
             * STAGE 1 PROMPT
             * ========================================================
             */
            $prompt = <<<PROMPT
You are an educational curriculum generator.

Analyze ONLY the learning material provided below.

Do not invent information.

Your task is ONLY to create:

1. A lesson title
2. A lesson description
3. 3 to 8 important topics

DO NOT generate questions.
DO NOT generate assessments.
DO NOT generate quizzes.
DO NOT generate practice questions.

Return ONLY valid JSON.

Do NOT return Markdown.
Do NOT return code fences.
Do NOT return explanations outside the JSON.

==================================================
LESSON
==================================================

{$titleInstruction}

The lesson title must remain relevant to the actual learning material.

Create a concise educational lesson description based ONLY on the material.

==================================================
TOPICS
==================================================

Create between 3 and 8 important topics.

Topics must:

- Be directly supported by the learning material.
- Be logically ordered.
- Cover important concepts.
- Not contain unrelated information.
- Not contain questions.
- Not contain assessments.

Each topic MUST contain:

{
    "name": "Topic name",
    "description": "Topic description"
}

==================================================
JSON STRUCTURE
==================================================

{
    "title": "Lesson title",
    "description": "Lesson description",
    "topics": [
        {
            "name": "Topic name",
            "description": "Topic description"
        }
    ]
}

==================================================
RULES
==================================================

1. Create 3 to 8 topics.
2. Topics must be based ONLY on the learning material.
3. Do not invent information.
4. Do not generate questions.
5. Do not generate assessments.
6. Do not generate quizzes.
7. Return JSON only.

==================================================
LEARNING MATERIAL
==================================================

{$content}

Return JSON only.
PROMPT;

            Log::info(
                'AI LESSON STAGE 1: generating lesson and topics',
                [
                    'file' => $file->getClientOriginalName(),
                    'easy_questions' => $easyCount,
                    'medium_questions' => $mediumCount,
                    'hard_questions' => $hardCount,
                ]
            );

            /**
             * ========================================================
             * GEMINI CALL #1
             * ========================================================
             */
            $lessonData = $gemini->generateJson($prompt);

            /**
             * ========================================================
             * VALIDATE GEMINI RESPONSE
             * ========================================================
             */
            if (
                empty($lessonData['title']) ||
                empty($lessonData['description']) ||
                !isset($lessonData['topics']) ||
                !is_array($lessonData['topics'])
            ) {
                throw new \RuntimeException(
                    'Gemini returned an invalid lesson/topic structure.'
                );
            }

            if (
                count($lessonData['topics']) < 3 ||
                count($lessonData['topics']) > 8
            ) {
                throw new \RuntimeException(
                    'Gemini must return between 3 and 8 topics.'
                );
            }

            /**
             * ========================================================
             * SAVE LESSON + TOPICS
             * ========================================================
             */
            $savedLesson = DB::transaction(function () use ($lessonData) {

                $lesson = Lesson::create([
                    'title' => $lessonData['title'],
                    'description' => $lessonData['description'],
                ]);

                foreach ($lessonData['topics'] as $topicData) {

                    if (empty($topicData['name'])) {
                        continue;
                    }

                    Topic::create([
                        'lesson_id' => $lesson->id,
                        'name' => $topicData['name'],
                        'description' => $topicData['description'] ?? null,
                    ]);
                }

                return $lesson->load('topics');
            });

            /**
             * ========================================================
             * SUCCESS
             * ========================================================
             */
            Log::info(
                'AI LESSON STAGE 1 COMPLETE',
                [
                    'lesson_id' => $savedLesson->id,
                    'topics' => $savedLesson->topics->count(),
                ]
            );

            return response()->json([
                'success' => true,

                'stage' => 'lesson_topics',

                'message' =>
                    'Lesson and topics generated successfully.',

                'data' => $savedLesson,

                'configuration' => [
                    'easy_questions' => $easyCount,
                    'medium_questions' => $mediumCount,
                    'hard_questions' => $hardCount,

                    'total_questions_per_topic' =>
                        $easyCount +
                        $mediumCount +
                        $hardCount,
                ],
            ]);

        } catch (\Throwable $e) {

            Log::error(
                'AI LESSON STAGE 1 FAILED',
                [
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]
            );

            return response()->json([
                'success' => false,

                'message' =>
                    'Failed to generate lesson and topics.',

                'error' =>
                    config('app.debug')
                        ? $e->getMessage()
                        : null,
            ], 500);
        }
    }


    /**
     * ============================================================
     * STAGE 2
     *
     * Topic -> Lesson + Topic -> Gemini -> Questions
     *
     * Frontend sends:
     *
     * - topic_id
     * - easy_questions
     * - medium_questions
     * - hard_questions
     *
     * Backend fetches:
     *
     * - Topic
     * - Lesson
     *
     * Then Gemini generates questions specifically
     * for that topic.
     * ============================================================
     */
    public function generateTopicQuestions(
        Request $request,
        GeminiService $gemini
    ) {
        set_time_limit(300);

        $validated = $request->validate([
            'topic_id' => [
                'required',
                'integer',
                'exists:topics,id',
            ],

            'easy_questions' => [
                'required',
                'integer',
                'min:0',
                'max:50',
            ],

            'medium_questions' => [
                'required',
                'integer',
                'min:0',
                'max:50',
            ],

            'hard_questions' => [
                'required',
                'integer',
                'min:0',
                'max:50',
            ],
        ]);

        $topicId = (int) $validated['topic_id'];

        $easyCount = (int) $validated['easy_questions'];
        $mediumCount = (int) $validated['medium_questions'];
        $hardCount = (int) $validated['hard_questions'];

        $totalCount =
            $easyCount +
            $mediumCount +
            $hardCount;

        /**
         * ========================================================
         * PREVENT EMPTY QUESTION REQUEST
         * ========================================================
         */
        if ($totalCount <= 0) {
            return response()->json([
                'success' => false,
                'message' =>
                    'At least one question must be requested.',
            ], 422);
        }

        try {

            /**
             * ========================================================
             * FETCH TOPIC + LESSON
             * ========================================================
             */
            $topic = Topic::with('lesson')
                ->findOrFail($topicId);

            if (!$topic->lesson) {
                throw new \RuntimeException(
                    'The topic does not have an associated lesson.'
                );
            }

            $lesson = $topic->lesson;

            /**
             * ========================================================
             * STAGE 2 PROMPT
             * ========================================================
             */
            $prompt = <<<PROMPT
You are an educational multiple-choice question generator.

Generate questions ONLY from the provided lesson and topic.

Do not use outside knowledge.

Do not invent facts.

Every question must be directly related to the topic.

==================================================
LESSON
==================================================

Lesson title:
{$lesson->title}

Lesson description:
{$lesson->description}

==================================================
TOPIC
==================================================

Topic name:
{$topic->name}

Topic description:
{$topic->description}

==================================================
QUESTION REQUIREMENTS
==================================================

Generate EXACTLY:

Easy: {$easyCount}
Medium: {$mediumCount}
Hard: {$hardCount}

Total: {$totalCount}

The difficulty distribution MUST be followed exactly.

==================================================
DIFFICULTY
==================================================

EASY:
- Recall
- Recognition
- Definitions
- Basic concepts

MEDIUM:
- Understanding
- Comparison
- Application
- Relationships between concepts

HARD:
- Analysis
- Deeper understanding
- Multi-concept application
- Reasoning

==================================================
QUESTION FORMAT
==================================================

Every question MUST contain:

{
    "question": "Question text",
    "choice_a": "Choice A",
    "choice_b": "Choice B",
    "choice_c": "Choice C",
    "choice_d": "Choice D",
    "correct_answer": "A",
    "explanation": "Explanation",
    "difficulty": "easy",
    "points": 1
}

==================================================
IMPORTANT RULES
==================================================

1. Generate exactly {$easyCount} easy questions.
2. Generate exactly {$mediumCount} medium questions.
3. Generate exactly {$hardCount} hard questions.
4. Generate exactly {$totalCount} questions.
5. Every question must have exactly four choices.
6. correct_answer must be A, B, C, or D.
7. difficulty must be easy, medium, or hard.
8. Do not duplicate questions.
9. Do not generate questions outside the topic.
10. Do not invent facts.
11. Do not include question IDs.
12. Questions must be educational.
13. Questions must be unambiguous.
14. Choices must be plausible.
15. Only one choice may be correct.
16. Vary the position of the correct answer.
17. Return JSON only.

==================================================
JSON FORMAT
==================================================

{
    "questions": [
        {
            "question": "Question",
            "choice_a": "A",
            "choice_b": "B",
            "choice_c": "C",
            "choice_d": "D",
            "correct_answer": "A",
            "explanation": "Explanation",
            "difficulty": "easy",
            "points": 1
        }
    ]
}

Return JSON only.
PROMPT;

            Log::info(
                'AI LESSON STAGE 2: generating topic questions',
                [
                    'lesson_id' => $lesson->id,
                    'topic_id' => $topic->id,
                    'topic' => $topic->name,
                    'easy_questions' => $easyCount,
                    'medium_questions' => $mediumCount,
                    'hard_questions' => $hardCount,
                    'total_questions' => $totalCount,
                ]
            );

            /**
             * ========================================================
             * GEMINI CALL #2
             * ========================================================
             */
            $data = $gemini->generateJson($prompt);

            /**
             * ========================================================
             * VALIDATE RESPONSE STRUCTURE
             * ========================================================
             */
            if (
                !isset($data['questions']) ||
                !is_array($data['questions'])
            ) {
                throw new \RuntimeException(
                    'Gemini returned invalid questions.'
                );
            }

            /**
             * ========================================================
             * VALIDATE TOTAL COUNT
             * ========================================================
             */
            if (count($data['questions']) !== $totalCount) {
                throw new \RuntimeException(
                    'Gemini returned ' .
                    count($data['questions']) .
                    " questions instead of {$totalCount}."
                );
            }

            /**
             * ========================================================
             * VALIDATE EVERY QUESTION
             * ========================================================
             */
            $actualEasy = 0;
            $actualMedium = 0;
            $actualHard = 0;

            $validAnswers = ['A', 'B', 'C', 'D'];

            foreach ($data['questions'] as $index => $question) {

                $requiredFields = [
                    'question',
                    'choice_a',
                    'choice_b',
                    'choice_c',
                    'choice_d',
                    'correct_answer',
                    'difficulty',
                ];

                foreach ($requiredFields as $field) {
                    if (
                        !isset($question[$field]) ||
                        trim((string) $question[$field]) === ''
                    ) {
                        throw new \RuntimeException(
                            "Question #" . ($index + 1) .
                            " is missing {$field}."
                        );
                    }
                }

                $difficulty = strtolower(
                    trim($question['difficulty'])
                );

                $correctAnswer = strtoupper(
                    trim($question['correct_answer'])
                );

                if (!in_array(
                    $difficulty,
                    ['easy', 'medium', 'hard'],
                    true
                )) {
                    throw new \RuntimeException(
                        "Question #" . ($index + 1) .
                        " has invalid difficulty."
                    );
                }

                if (!in_array(
                    $correctAnswer,
                    $validAnswers,
                    true
                )) {
                    throw new \RuntimeException(
                        "Question #" . ($index + 1) .
                        " has invalid correct answer."
                    );
                }

                if ($difficulty === 'easy') {
                    $actualEasy++;
                }

                if ($difficulty === 'medium') {
                    $actualMedium++;
                }

                if ($difficulty === 'hard') {
                    $actualHard++;
                }
            }

            /**
             * ========================================================
             * VALIDATE DIFFICULTY COUNTS
             * ========================================================
             */
            if ($actualEasy !== $easyCount) {
                throw new \RuntimeException(
                    "Gemini returned {$actualEasy} easy questions instead of {$easyCount}."
                );
            }

            if ($actualMedium !== $mediumCount) {
                throw new \RuntimeException(
                    "Gemini returned {$actualMedium} medium questions instead of {$mediumCount}."
                );
            }

            if ($actualHard !== $hardCount) {
                throw new \RuntimeException(
                    "Gemini returned {$actualHard} hard questions instead of {$hardCount}."
                );
            }

            /**
             * ========================================================
             * SAVE QUESTIONS
             * ========================================================
             */
            $result = DB::transaction(function () use (
                $topic,
                $data
            ) {

                $created = 0;

                foreach ($data['questions'] as $question) {

                    Question::create([
                        'topic_id' => $topic->id,

                        'question' =>
                            trim($question['question']),

                        'choice_a' =>
                            trim($question['choice_a']),

                        'choice_b' =>
                            trim($question['choice_b']),

                        'choice_c' =>
                            trim($question['choice_c']),

                        'choice_d' =>
                            trim($question['choice_d']),

                        'correct_answer' =>
                            strtoupper(
                                trim($question['correct_answer'])
                            ),

                        'explanation' =>
                            $question['explanation'] ?? null,

                        'difficulty' =>
                            strtolower(
                                trim($question['difficulty'])
                            ),

                        'points' =>
                            isset($question['points'])
                                ? (int) $question['points']
                                : 1,
                    ]);

                    $created++;
                }

                return [
                    'questions_created' => $created,
                ];
            });

            /**
             * ========================================================
             * SUCCESS
             * ========================================================
             */
            Log::info(
                'AI LESSON STAGE 2 COMPLETE',
                [
                    'lesson_id' => $lesson->id,
                    'topic_id' => $topic->id,
                    'questions_created' =>
                        $result['questions_created'],
                ]
            );

            return response()->json([
                'success' => true,

                'stage' => 'topic_questions',

                'message' =>
                    'Topic questions generated successfully.',

                'data' => [
                    'lesson_id' => $lesson->id,
                    'lesson_title' => $lesson->title,

                    'topic_id' => $topic->id,
                    'topic_name' => $topic->name,

                    'easy_questions' => $easyCount,
                    'medium_questions' => $mediumCount,
                    'hard_questions' => $hardCount,

                    'questions_created' =>
                        $result['questions_created'],
                ],
            ]);

        } catch (\Throwable $e) {

            Log::error(
                'AI LESSON STAGE 2 FAILED',
                [
                    'topic_id' => $topicId,
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]
            );

            return response()->json([
                'success' => false,

                'message' =>
                    'Failed to generate topic questions.',

                'error' =>
                    config('app.debug')
                        ? $e->getMessage()
                        : null,
            ], 500);
        }
    }
}
