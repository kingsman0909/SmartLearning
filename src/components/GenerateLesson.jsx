import React, { useRef, useState } from "react";

import "../styles/homepage.css";

const MIN_QUESTIONS = 1;
const QUESTION_STEP = 2;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".pdf"];

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000/api";

const MAX_RESUME_ATTEMPTS = 6;
const RESUME_DELAY_MS = 1200;

const GenerateLesson = ({
    onLessonGenerated,
    showToast,
    user,
}) => {
    const fileInputRef = useRef(null);

    // ============================================================
    // STATE
    // ============================================================

    const [file, setFile] = useState(null);

    const [step, setStep] = useState("upload");

    const [dragActive, setDragActive] = useState(false);

    const [error, setError] = useState("");

    const [lessonTitle, setLessonTitle] = useState("");

    const [easyQuestions, setEasyQuestions] =
        useState(MIN_QUESTIONS);

    const [mediumQuestions, setMediumQuestions] =
        useState(MIN_QUESTIONS);

    const [hardQuestions, setHardQuestions] =
        useState(MIN_QUESTIONS);

    const [generatedLesson, setGeneratedLesson] =
        useState(null);

    const [isProcessing, setIsProcessing] =
        useState(false);

    const [isSaving, setIsSaving] =
        useState(false);

    const [generationProgress, setGenerationProgress] =
        useState({
            currentTopic: 0,
            totalTopics: 0,
            currentTopicName: "",
            completedTopics: 0,
        });

    // ============================================================
    // USER
    // ============================================================

    const userId = user?.id;

    // ============================================================
    // HELPERS
    // ============================================================

    const getToken = () => {
        return (
            localStorage.getItem("token") ||
            localStorage.getItem("auth_token") ||
            localStorage.getItem("access_token")
        );
    };

    const notify = (message, type = "info") => {
        if (typeof showToast === "function") {
            showToast(message, type);
        }
    };

    const showError = (message) => {
        setError(message);
        notify(message, "error");
    };

    const sleep = (ms) =>
        new Promise((resolve) =>
            setTimeout(resolve, ms)
        );

    const getFileNameWithoutExtension = (fileName) => {
        if (!fileName) {
            return "Untitled Lesson";
        }

        return fileName.replace(
            /\.[^/.]+$/,
            ""
        );
    };

    // ============================================================
    // FILE VALIDATION
    // ============================================================

    const validateFile = (selectedFile) => {
        if (!selectedFile) {
            return "Please select a file.";
        }

        const fileName =
            selectedFile.name.toLowerCase();

        const isAllowed =
            ALLOWED_EXTENSIONS.some((extension) =>
                fileName.endsWith(extension)
            );

        if (!isAllowed) {
            return (
                "Unsupported file type. Please upload a PDF file."
            );
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            return (
                "File is too large. Maximum file size is 20 MB."
            );
        }

        if (selectedFile.size === 0) {
            return "The selected file is empty.";
        }

        return "";
    };

    // ============================================================
    // FILE HANDLING
    // ============================================================

    const handleFile = (selectedFile) => {
        setError("");

        if (!selectedFile) {
            return;
        }

        const validationError =
            validateFile(selectedFile);

        if (validationError) {
            showError(validationError);
            return;
        }

        setFile(selectedFile);

        setLessonTitle(
            getFileNameWithoutExtension(
                selectedFile.name
            )
        );

        setStep("upload");

        setGeneratedLesson(null);

        setGenerationProgress({
            currentTopic: 0,
            totalTopics: 0,
            currentTopicName: "",
            completedTopics: 0,
        });
    };

    const handleFileChange = (event) => {
        const selectedFile =
            event.target.files?.[0];

        handleFile(selectedFile);
    };

    const handleDrop = (event) => {
        event.preventDefault();

        setDragActive(false);

        const droppedFile =
            event.dataTransfer.files?.[0];

        handleFile(droppedFile);
    };

    const handleDragOver = (event) => {
        event.preventDefault();

        if (!file) {
            setDragActive(true);
        }
    };

    const handleDragLeave = (event) => {
        event.preventDefault();

        setDragActive(false);
    };

    const removeFile = (event) => {
        event?.stopPropagation();

        setFile(null);
        setGeneratedLesson(null);
        setLessonTitle("");
        setError("");

        setGenerationProgress({
            currentTopic: 0,
            totalTopics: 0,
            currentTopicName: "",
            completedTopics: 0,
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // ============================================================
    // QUESTION VALIDATION
    // ============================================================

    const isValidQuestionCount = (value) => {
        return (
            Number.isInteger(value) &&
            value >= MIN_QUESTIONS
        );
    };

    const validateQuestions = () => {
        return (
            isValidQuestionCount(easyQuestions) &&
            isValidQuestionCount(mediumQuestions) &&
            isValidQuestionCount(hardQuestions)
        );
    };

    // ============================================================
    // STEP 1 -> STEP 2
    // ============================================================

    const continueToConfigure = () => {
        setError("");

        if (!file) {
            showError(
                "Please select a PDF file first."
            );

            return;
        }

        if (!lessonTitle.trim()) {
            setLessonTitle(
                getFileNameWithoutExtension(
                    file.name
                )
            );
        }

        setStep("configure");
    };

    // ============================================================
    // API RESPONSE PARSER
    // ============================================================

    const parseResponse = async (response) => {
        const responseText =
            await response.text();

        let data = {};

        try {
            data = responseText
                ? JSON.parse(responseText)
                : {};
        } catch (error) {
            console.error(
                "Invalid JSON response:",
                responseText
            );

            throw new Error(
                "The server returned an invalid response."
            );
        }

        /*
         * Laravel can intentionally return HTTP 500 when
         * question generation is partial but resumable.
         */

        if (
            !response.ok &&
            data?.resumable !== true
        ) {
            console.error(
                "Backend error:",
                data
            );

            if (data?.errors) {
                const firstError =
                    Object.values(data.errors)
                        ?.flat?.()
                        ?.find(Boolean);

                if (firstError) {
                    throw new Error(firstError);
                }
            }

            throw new Error(
                data?.message ||
                    data?.error ||
                    "Request failed."
            );
        }

        return data;
    };

    // ============================================================
    // NORMALIZE BACKEND PROGRESS
    // ============================================================

    const getTopicProgress = (
    data,
    expectedEasy,
    expectedMedium,
    expectedHard
) => {
    /*
     * Backend progress priority:
     *
     * 1. progress
     * 2. current_counts
     * 3. generated_now
     *
     * IMPORTANT:
     * generated_now means questions generated during the
     * current request, NOT necessarily the total already
     * stored in the database.
     */

    const progress = data?.progress || {};

    const currentCounts =
        data?.current_counts || {};

    const generatedNow =
        data?.generated_now || {};

    const readDifficultyProgress = (
        difficulty
    ) => {
        // --------------------------------------------------------
        // 1. progress[difficulty]
        // --------------------------------------------------------

        const progressValue =
            progress?.[difficulty];

        if (
            progressValue !== undefined &&
            progressValue !== null
        ) {
            if (
                typeof progressValue === "object"
            ) {
                const current =
                    progressValue.current ??
                    progressValue.generated ??
                    progressValue.count;

                if (
                    current !== undefined &&
                    current !== null
                ) {
                    return Number(current);
                }
            }

            if (
                typeof progressValue === "number" ||
                typeof progressValue === "string"
            ) {
                return Number(progressValue);
            }
        }

        // --------------------------------------------------------
        // 2. current_counts
        //
        // This represents the actual DB count returned
        // by the backend.
        // --------------------------------------------------------

        const currentValue =
            currentCounts?.[difficulty];

        if (
            currentValue !== undefined &&
            currentValue !== null
        ) {
            if (
                typeof currentValue === "object"
            ) {
                const current =
                    currentValue.current ??
                    currentValue.count ??
                    currentValue.generated;

                if (
                    current !== undefined &&
                    current !== null
                ) {
                    return Number(current);
                }
            }

            if (
                typeof currentValue === "number" ||
                typeof currentValue === "string"
            ) {
                return Number(currentValue);
            }
        }

        // --------------------------------------------------------
        // 3. generated_now
        //
        // Last fallback only.
        // --------------------------------------------------------

        const generatedValue =
            generatedNow?.[difficulty];

        if (
            generatedValue !== undefined &&
            generatedValue !== null
        ) {
            if (
                typeof generatedValue === "object"
            ) {
                const generated =
                    generatedValue.generated ??
                    generatedValue.current ??
                    generatedValue.count;

                if (
                    generated !== undefined &&
                    generated !== null
                ) {
                    return Number(generated);
                }
            }

            if (
                typeof generatedValue === "number" ||
                typeof generatedValue === "string"
            ) {
                return Number(generatedValue);
            }
        }

        return 0;
    };

    const easy = Math.min(
        expectedEasy,
        Math.max(
            0,
            readDifficultyProgress("easy")
        )
    );

    const medium = Math.min(
        expectedMedium,
        Math.max(
            0,
            readDifficultyProgress("medium")
        )
    );

    const hard = Math.min(
        expectedHard,
        Math.max(
            0,
            readDifficultyProgress("hard")
        )
    );

    const calculatedTotal =
        easy +
        medium +
        hard;

    // ------------------------------------------------------------
    // Backend may explicitly provide total_current
    // ------------------------------------------------------------

    const backendTotalCandidates = [
        progress?.total_current,
        currentCounts?.total,
        currentCounts?.total_current,
    ];

    let backendTotal = null;

    for (
        const candidate of backendTotalCandidates
    ) {
        if (
            candidate !== undefined &&
            candidate !== null &&
            Number.isFinite(
                Number(candidate)
            )
        ) {
            backendTotal =
                Number(candidate);

            break;
        }
    }

    const totalCurrent = Math.min(
        expectedEasy +
            expectedMedium +
            expectedHard,

        Math.max(
            calculatedTotal,
            backendTotal ?? 0
        )
    );

    const totalTarget = Math.max(
        expectedEasy +
            expectedMedium +
            expectedHard,

        Number(
            progress?.total_target ??
                expectedEasy +
                    expectedMedium +
                    expectedHard
        )
    );

    return {
        easy,
        medium,
        hard,
        totalCurrent,
        totalTarget,
    };
};
    // ============================================================
    // STAGE 2
    //
    // Generate questions for ONE topic.
    // ============================================================

    const generateQuestionsForTopic = async (
        topic,
        token,
        topicIndex,
        totalTopics
    ) => {
        if (!topic?.id) {
            throw new Error(
                "Generated topic does not have a valid ID."
            );
        }

        const topicName =
            topic.name ||
            topic.title ||
            `Topic ${topicIndex + 1}`;

        const expectedEasy =
            Number(easyQuestions);

        const expectedMedium =
            Number(mediumQuestions);

        const expectedHard =
            Number(hardQuestions);

        const expectedTotal =
            expectedEasy +
            expectedMedium +
            expectedHard;

        let latestData = null;

        for (
            let attempt = 1;
            attempt <= MAX_RESUME_ATTEMPTS;
            attempt++
        ) {
            setGenerationProgress({
                currentTopic:
                    topicIndex + 1,

                totalTopics,

                currentTopicName:
                    topicName,

                completedTopics:
                    topicIndex,
            });

            console.log(
                "========================================"
            );

            console.log(
                `TOPIC ${topicIndex + 1}/${totalTopics} - ATTEMPT ${attempt}`
            );

            console.log({
                topic_id:
                    topic.id,

                topic_name:
                    topicName,

                easy_questions:
                    expectedEasy,

                medium_questions:
                    expectedMedium,

                hard_questions:
                    expectedHard,

                total_questions:
                    expectedTotal,
            });

            console.log(
                "========================================"
            );

            const response = await fetch(
                `${API_BASE_URL}/ai/generate-topic-questions`,
                {
                    method: "POST",

                    headers: {
                        Accept:
                            "application/json",

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`,
                    },

                    body: JSON.stringify({
                        topic_id:
                            topic.id,

                        easy_questions:
                            expectedEasy,

                        medium_questions:
                            expectedMedium,

                        hard_questions:
                            expectedHard,
                    }),
                }
            );

            const data =
                await parseResponse(response);

            latestData = data;

            console.log(
                `Topic ${topicIndex + 1} response:`,
                data
            );

            // ====================================================
            // READ PROGRESS
            // ====================================================

            const progress =
                getTopicProgress(
                    data,
                    expectedEasy,
                    expectedMedium,
                    expectedHard
                );

            console.log(
                "Normalized topic progress:",
                progress
            );

            const isComplete =
                progress.totalCurrent >=
                expectedTotal;

            // ====================================================
            // SUCCESS
            // ====================================================

            if (
                data?.success === true ||
                isComplete
            ) {
                console.log(
                    `✅ Topic "${topicName}" completed: ${progress.totalCurrent}/${expectedTotal}`
                );

                setGenerationProgress({
                    currentTopic:
                        topicIndex + 1,

                    totalTopics,

                    currentTopicName:
                        topicName,

                    completedTopics:
                        topicIndex + 1,
                });

                return {
                    ...data,

                    progress: {
                        ...data?.progress,

                        easy: {
                            current:
                                progress.easy,
                        },

                        medium: {
                            current:
                                progress.medium,
                        },

                        hard: {
                            current:
                                progress.hard,
                        },

                        total_current:
                            progress.totalCurrent,

                        total_target:
                            expectedTotal,
                    },
                };
            }

            // ====================================================
            // RESUMABLE PARTIAL GENERATION
            // ====================================================

            if (
                data?.resumable === true
            ) {
                const remaining =
                    Math.max(
                        0,
                        expectedTotal -
                            progress.totalCurrent
                    );

                console.warn(
                    `⚠️ Topic "${topicName}" is partial: ${progress.totalCurrent}/${expectedTotal}. Remaining: ${remaining}`
                );

                notify(
                    `Continuing "${topicName}" — ${progress.totalCurrent}/${expectedTotal} questions generated.`,
                    "info"
                );

                if (
                    attempt <
                    MAX_RESUME_ATTEMPTS
                ) {
                    const delay =
                        RESUME_DELAY_MS +
                        (
                            attempt - 1
                        ) *
                            600;

                    console.log(
                        `Waiting ${delay}ms before resuming topic "${topicName}"...`
                    );

                    await sleep(delay);

                    continue;
                }
            }

            // ====================================================
            // NON-RESUMABLE FAILURE
            // ====================================================

            throw new Error(
                data?.message ||
                    data?.error ||
                    `Failed to generate questions for "${topicName}".`
            );
        }

        // ========================================================
        // MAX RETRIES
        // ========================================================

        const finalProgress =
            getTopicProgress(
                latestData || {},
                expectedEasy,
                expectedMedium,
                expectedHard
            );

        throw new Error(
            `Question generation for "${topicName}" could not be completed after ${MAX_RESUME_ATTEMPTS} attempts. Current progress: ${finalProgress.totalCurrent}/${expectedTotal}.`
        );
    };

    // ============================================================
    // STAGE 3
    //
    // Generate assessments AFTER all questions are complete.
    // ============================================================

    const generateAssessments = async (
        lessonId,
        token
    ) => {
        if (!lessonId) {
            throw new Error(
                "Lesson ID is missing. Cannot generate assessments."
            );
        }

        console.log(
            "========================================"
        );

        console.log(
            "STAGE 3: Generating assessments..."
        );

        console.log({
            lesson_id:
                lessonId,
        });

        console.log(
            "========================================"
        );

        setGenerationProgress(
            (current) => ({
                ...current,

                currentTopicName:
                    "Creating assessments...",
            })
        );

        const response = await fetch(
            `${API_BASE_URL}/assessments/generate`,
            {
                method: "POST",

                headers: {
                    Accept:
                        "application/json",

                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`,
                },

                body: JSON.stringify({
                    lesson_id:
                        lessonId,
                }),
            }
        );

        const data =
            await parseResponse(response);

        console.log(
            "STAGE 3 RESPONSE:",
            data
        );

        if (!data?.success) {
            throw new Error(
                data?.message ||
                    "Assessment generation failed."
            );
        }

        console.log(
            "✅ Assessments generated successfully:",
            data?.data
        );

        return data;
    };

    // ============================================================
    // STEP 2 -> GENERATE
    // ============================================================

    const startGeneration = async () => {
        if (!file || isProcessing) {
            return;
        }

        if (!validateQuestions()) {
            showError(
                `Each difficulty must have at least ${MIN_QUESTIONS} questions.`
            );

            return;
        }

        if (!lessonTitle.trim()) {
            showError(
                "Please enter a lesson title."
            );

            return;
        }

        // ========================================================
        // USER ID VALIDATION
        // ========================================================

        if (
            userId === undefined ||
            userId === null ||
            userId === ""
        ) {
            console.error(
                "GenerateLesson: user object:",
                user
            );

            showError(
                "User ID is missing. Please refresh the page and log in again."
            );

            return;
        }

        const numericUserId =
            Number(userId);

        if (
            !Number.isInteger(
                numericUserId
            ) ||
            numericUserId <= 0
        ) {
            console.error(
                "Invalid user.id:",
                userId
            );

            showError(
                "Invalid user ID. Please refresh the page and log in again."
            );

            return;
        }

        setError("");

        setIsProcessing(true);

        setStep("processing");

        try {
            const token =
                getToken();

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please log in again."
                );
            }

            // ====================================================
            // STAGE 1
            // ====================================================

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            formData.append(
                "lesson_title",
                lessonTitle.trim()
            );

            formData.append(
                "easy_questions",
                String(easyQuestions)
            );

            formData.append(
                "medium_questions",
                String(mediumQuestions)
            );

            formData.append(
                "hard_questions",
                String(hardQuestions)
            );

            formData.append(
                "user_id",
                String(numericUserId)
            );

            console.log(
                "========================================"
            );

            console.log(
                "STAGE 1: Generating lesson and topics..."
            );

            console.log({
                file:
                    file.name,

                lesson_title:
                    lessonTitle.trim(),

                easy_questions:
                    easyQuestions,

                medium_questions:
                    mediumQuestions,

                hard_questions:
                    hardQuestions,

                total_questions_per_topic:
                    easyQuestions +
                    mediumQuestions +
                    hardQuestions,

                user_id:
                    numericUserId,
            });

            console.log(
                "========================================"
            );

            const lessonResponse =
                await fetch(
                    `${API_BASE_URL}/ai/generate-lesson`,
                    {
                        method: "POST",

                        headers: {
                            Accept:
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            formData,
                    }
                );

            const lessonData =
                await parseResponse(
                    lessonResponse
                );

            console.log(
                "STAGE 1 RESPONSE:",
                lessonData
            );

            if (!lessonData?.success) {
                throw new Error(
                    lessonData?.message ||
                        "Lesson generation failed."
                );
            }

            // ====================================================
            // SAVED LESSON
            // ====================================================

            const savedLesson =
                lessonData?.data;

            if (!savedLesson) {
                throw new Error(
                    "Lesson was generated but no lesson data was returned."
                );
            }

            console.log(
                "Saved lesson:",
                savedLesson
            );

            // ====================================================
            // ASSIGNMENT
            // ====================================================

            console.log(
                "Lesson assignment:",
                lessonData?.assignment
            );

            // ====================================================
            // TOPICS
            // ====================================================

            const generatedTopics =
                Array.isArray(
                    savedLesson.topics
                )
                    ? savedLesson.topics
                    : [];

            if (
                generatedTopics.length === 0
            ) {
                throw new Error(
                    "Lesson was created, but no topics were returned."
                );
            }

            console.log(
                `Found ${generatedTopics.length} topics.`
            );

            console.log(
                "Topics:",
                generatedTopics
            );

            setGenerationProgress({
                currentTopic: 0,

                totalTopics:
                    generatedTopics.length,

                currentTopicName:
                    "",

                completedTopics:
                    0,
            });

            // ====================================================
            // STAGE 2
            // ====================================================

            console.log(
                "========================================"
            );

            console.log(
                "STAGE 2: Generating questions per topic..."
            );

            console.log(
                "Sequential generation enabled."
            );

            console.log(
                "========================================"
            );

            const questionResults = [];

            for (
                let index = 0;
                index < generatedTopics.length;
                index++
            ) {
                const topic =
                    generatedTopics[index];

                const topicResult =
                    await generateQuestionsForTopic(
                        topic,
                        token,
                        index,
                        generatedTopics.length
                    );

                questionResults.push({
                    topicId:
                        topic.id,

                    topicName:
                        topic.name ||
                        topic.title ||
                        `Topic ${index + 1}`,

                    result:
                        topicResult,
                });

                console.log(
                    `✅ Finished topic ${index + 1}/${generatedTopics.length}`
                );
            }

            // ====================================================
            // STAGE 2 COMPLETE
            // ====================================================

            console.log(
                "========================================"
            );

            console.log(
                "STAGE 2 COMPLETE"
            );

            console.log(
                "ALL TOPIC QUESTIONS COMPLETED."
            );

            console.log(
                "Question generation results:",
                questionResults
            );

            console.log(
                "========================================"
            );

            // ====================================================
            // VERIFY ALL TOPICS COMPLETED
            // ====================================================

            if (
                questionResults.length !==
                generatedTopics.length
            ) {
                throw new Error(
                    "Not all topics finished question generation. Assessments will not be created."
                );
            }

            // ====================================================
            // STAGE 3
            //
            // ONLY NOW create assessments.
            // ====================================================

            notify(
                "All questions generated. Creating assessments...",
                "info"
            );

            const assessmentData =
                await generateAssessments(
                    savedLesson.id,
                    token
                );

            // ====================================================
            // STAGE 3 COMPLETE
            // ====================================================

            console.log(
                "========================================"
            );

            console.log(
                "STAGE 3 COMPLETE"
            );

            console.log(
                "Assessment results:",
                assessmentData
            );

            console.log(
                "========================================"
            );

            // ====================================================
            // NORMALIZED ASSESSMENTS
            // ====================================================

            const normalizedAssessments =
                Array.isArray(
                    assessmentData?.data
                )
                    ? assessmentData.data
                    : [];

            if (
                normalizedAssessments.length === 0
            ) {
                throw new Error(
                    "Questions were generated, but no assessments were created."
                );
            }

            console.log(
                `✅ ${normalizedAssessments.length} assessments created.`
            );

            // ====================================================
            // NORMALIZE TOPICS
            // ====================================================

            const normalizedTopics =
                generatedTopics.map(
                    (topic, index) => {
                        const result =
                            questionResults.find(
                                (item) =>
                                    Number(
                                        item.topicId
                                    ) ===
                                    Number(
                                        topic.id
                                    )
                            );

                        const resultData =
                            result?.result ||
                            {};

                        const resultQuestions =
                            Array.isArray(
                                resultData
                                    ?.data
                                    ?.questions
                            )
                                ? resultData
                                      .data
                                      .questions
                                : [];

                        const resultProgress =
                            getTopicProgress(
                                resultData,
                                Number(
                                    easyQuestions
                                ),
                                Number(
                                    mediumQuestions
                                ),
                                Number(
                                    hardQuestions
                                )
                            );

                        const expectedTopicQuestions =
                            Number(
                                easyQuestions
                            ) +
                            Number(
                                mediumQuestions
                            ) +
                            Number(
                                hardQuestions
                            );

                        const actualQuestionCount =
                            Math.max(
                                resultProgress.totalCurrent,
                                resultQuestions.length
                            );

                        const topicAssessment =
                            normalizedAssessments.find(
                                (
                                    assessment
                                ) =>
                                    Number(
                                        assessment.topic_id
                                    ) ===
                                    Number(
                                        topic.id
                                    )
                            ) || null;

                        return {
                            id:
                                topic.id,

                            title:
                                topic.name ||
                                topic.title ||
                                "Untitled Topic",

                            name:
                                topic.name ||
                                topic.title ||
                                "Untitled Topic",

                            description:
                                topic.description ||
                                "",

                            questions:
                                resultQuestions,

                            assessment:
                                topicAssessment,

                            questionsGenerated:
                                actualQuestionCount >=
                                expectedTopicQuestions,

                            questionCount:
                                actualQuestionCount,

                            questionProgress: {
                                easy:
                                    resultProgress.easy,

                                medium:
                                    resultProgress.medium,

                                hard:
                                    resultProgress.hard,

                                total:
                                    resultProgress.totalCurrent,

                                target:
                                    expectedTopicQuestions,
                            },
                        };
                    }
                );

            // ====================================================
            // NORMALIZED LESSON
            // ====================================================

            const totalQuestionsPerTopic =
                Number(easyQuestions) +
                Number(mediumQuestions) +
                Number(hardQuestions);

            const normalizedLesson = {
                id:
                    savedLesson.id,

                title:
                    savedLesson.title ||
                    lessonTitle.trim() ||
                    getFileNameWithoutExtension(
                        file.name
                    ),

                overview:
                    savedLesson.description ||
                    "Generated from uploaded learning material.",

                description:
                    savedLesson.description ||
                    "",

                topics:
                    normalizedTopics,

                questions: {
                    easy:
                        Number(easyQuestions),

                    medium:
                        Number(mediumQuestions),

                    hard:
                        Number(hardQuestions),
                },

                totalQuestions:
                    totalQuestionsPerTopic,

                totalQuestionsAllTopics:
                    totalQuestionsPerTopic *
                    generatedTopics.length,

                assessments:
                    normalizedAssessments,

                raw:
                    savedLesson,

                assignedUserId:
                    numericUserId,

                assignment:
                    lessonData?.assignment ||
                    {
                        user_id:
                            numericUserId,

                        lesson_id:
                            savedLesson.id,

                        status:
                            "not_started",

                        progress:
                            0,
                    },

                questionGenerationCompleted:
                    true,

                assessmentGenerationCompleted:
                    true,
            };

            // ====================================================
            // STATE
            // ====================================================

            setGeneratedLesson(
                normalizedLesson
            );

            setLessonTitle(
                normalizedLesson.title
            );

            // ====================================================
            // FINAL PROGRESS
            // ====================================================

            setGenerationProgress({
                currentTopic:
                    generatedTopics.length,

                totalTopics:
                    generatedTopics.length,

                currentTopicName:
                    "All questions and assessments completed",

                completedTopics:
                    generatedTopics.length,
            });

            // ====================================================
            // PREVIEW
            // ====================================================

            setStep("preview");

            notify(
                `Lesson, questions, and ${normalizedAssessments.length} assessments generated successfully!`,
                "success"
            );

            // ====================================================
            // CALLBACK
            // ====================================================

            if (
                typeof onLessonGenerated ===
                "function"
            ) {
                try {
                    onLessonGenerated(
                        normalizedLesson
                    );
                } catch (
                    callbackError
                ) {
                    console.error(
                        "onLessonGenerated error:",
                        callbackError
                    );
                }
            }

        } catch (err) {
            console.error(
                "Lesson/question/assessment generation error:",
                err
            );

            setStep("configure");

            showError(
                err?.message ||
                    "Unable to generate the lesson, questions, and assessments."
            );
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================
    // SAVE LESSON
    // ============================================================

    const saveLesson = async (event) => {
        event?.preventDefault();
        event?.stopPropagation();

        if (
            !generatedLesson ||
            isSaving
        ) {
            return;
        }

        setIsSaving(true);

        setError("");

        try {
            console.log(
                "Lesson, questions, and assessments already saved in database:",
                generatedLesson
            );

            notify(
                "Lesson, questions, and assessments are already saved successfully.",
                "success"
            );
        } catch (err) {
            console.error(
                "Save lesson error:",
                err
            );

            showError(
                "Unable to confirm lesson save."
            );
        } finally {
            setIsSaving(false);
        }
    };

    // ============================================================
    // RESET
    // ============================================================

    const resetGenerator = () => {
        setFile(null);

        setStep("upload");

        setDragActive(false);

        setError("");

        setLessonTitle("");

        setEasyQuestions(
            MIN_QUESTIONS
        );

        setMediumQuestions(
            MIN_QUESTIONS
        );

        setHardQuestions(
            MIN_QUESTIONS
        );

        setGeneratedLesson(null);

        setIsProcessing(false);

        setIsSaving(false);

        setGenerationProgress({
            currentTopic: 0,
            totalTopics: 0,
            currentTopicName: "",
            completedTopics: 0,
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // ============================================================
    // FILE SIZE
    // ============================================================

    const formatFileSize = (bytes) => {
        if (!bytes) {
            return "0 KB";
        }

        const mb =
            bytes / (1024 * 1024);

        if (mb >= 1) {
            return `${mb.toFixed(2)} MB`;
        }

        return `${Math.max(
            1,
            Math.round(bytes / 1024)
        )} KB`;
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="generate-lesson">

            {/* HEADER */}

            <div className="generate-lesson-header">
                <div>
                    <span className="generate-eyebrow">
                        AI LESSON GENERATOR
                    </span>

                    <h1>
                        Create a New Lesson
                    </h1>

                    <p>
                        Upload your learning
                        material and create a
                        structured lesson with
                        topics and assessment
                        questions.
                    </p>
                </div>
            </div>

            {/* ERROR */}

            {error && (
                <div
                    className="generator-error"
                    role="alert"
                >
                    <span>
                        ⚠️
                    </span>

                    <p>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        aria-label="Close error"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* STEP INDICATOR */}

            <div className="generator-steps">

                <div
                    className={`generator-step ${
                        step === "upload"
                            ? "active"
                            : [
                                  "configure",
                                  "processing",
                                  "preview",
                              ].includes(step)
                            ? "completed"
                            : ""
                    }`}
                >
                    <span>
                        {step === "upload"
                            ? "1"
                            : "✓"}
                    </span>

                    <p>
                        Upload
                    </p>
                </div>

                <div className="step-line" />

                <div
                    className={`generator-step ${
                        step === "configure"
                            ? "active"
                            : [
                                  "processing",
                                  "preview",
                              ].includes(step)
                            ? "completed"
                            : ""
                    }`}
                >
                    <span>
                        {[
                            "processing",
                            "preview",
                        ].includes(step)
                            ? "✓"
                            : "2"}
                    </span>

                    <p>
                        Configure
                    </p>
                </div>

                <div className="step-line" />

                <div
                    className={`generator-step ${
                        step === "processing"
                            ? "active"
                            : step === "preview"
                            ? "completed"
                            : ""
                    }`}
                >
                    <span>
                        {step === "preview"
                            ? "✓"
                            : "3"}
                    </span>

                    <p>
                        Generate
                    </p>
                </div>

                <div className="step-line" />

                <div
                    className={`generator-step ${
                        step === "preview"
                            ? "active"
                            : ""
                    }`}
                >
                    <span>
                        4
                    </span>

                    <p>
                        Preview
                    </p>
                </div>

            </div>

            {/* ==================================================
                STEP 1
            ================================================== */}

            {step === "upload" && (
                <div className="generator-card">

                    <div className="generator-card-title">

                        <h2>
                            Upload Learning Material
                        </h2>

                        <p>
                            Upload the material
                            that will be used to
                            create your lesson.
                        </p>

                    </div>

                    <div
                        className={`upload-zone ${
                            dragActive
                                ? "drag-active"
                                : ""
                        } ${
                            file
                                ? "has-file"
                                : ""
                        }`}
                        onDrop={handleDrop}
                        onDragOver={
                            handleDragOver
                        }
                        onDragLeave={
                            handleDragLeave
                        }
                        onClick={() => {
                            if (!file) {
                                fileInputRef.current?.click();
                            }
                        }}
                    >

                        {!file ? (
                            <>
                                <div className="upload-icon">
                                    📄
                                </div>

                                <h3>
                                    Drop your PDF here
                                </h3>

                                <p>
                                    or click to browse
                                    from your device
                                </p>

                                <span className="upload-supported">
                                    PDF · Maximum
                                    20 MB
                                </span>
                            </>
                        ) : (
                            <div className="selected-file">

                                <div className="selected-file-icon">
                                    📄
                                </div>

                                <div className="selected-file-info">

                                    <strong>
                                        {file.name}
                                    </strong>

                                    <span>
                                        {formatFileSize(
                                            file.size
                                        )}
                                    </span>

                                </div>

                                <button
                                    type="button"
                                    className="remove-file"
                                    onClick={
                                        removeFile
                                    }
                                    aria-label="Remove file"
                                >
                                    ×
                                </button>

                            </div>
                        )}

                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept=".pdf"
                        onChange={
                            handleFileChange
                        }
                    />

                    <div className="upload-actions">

                        <button
                            type="button"
                            className="generate-primary-btn"
                            disabled={!file}
                            onClick={
                                continueToConfigure
                            }
                        >
                            ✨ Continue to Configure
                        </button>

                    </div>

                </div>
            )}

            {/* ==================================================
                STEP 2
            ================================================== */}

            {step === "configure" && (
                <div className="generator-card">

                    <div className="generator-card-title">

                        <span className="success-badge">
                            ✓ Material Ready
                        </span>

                        <h2>
                            Configure Your Lesson
                        </h2>

                        <p>
                            Review the lesson
                            information and choose
                            how many questions AI
                            should generate.
                        </p>

                    </div>

                    <div className="form-group">

                        <label htmlFor="lesson-title">
                            Lesson Title
                        </label>

                        <input
                            id="lesson-title"
                            type="text"
                            value={lessonTitle}
                            onChange={(event) =>
                                setLessonTitle(
                                    event.target.value
                                )
                            }
                            placeholder="Enter lesson title"
                            maxLength={150}
                        />

                    </div>

                    <div className="topics-preview">

                        <div className="section-heading">

                            <div>

                                <h3>
                                    Uploaded Material
                                </h3>

                                <p>
                                    This material
                                    will be analyzed
                                    by AI when you
                                    generate the lesson.
                                </p>

                            </div>

                        </div>

                        <div className="generated-topic">

                            <div className="topic-number">
                                📄
                            </div>

                            <div>

                                <h4>
                                    {file?.name}
                                </h4>

                                <p>
                                    {file
                                        ? formatFileSize(
                                              file.size
                                          )
                                        : ""}
                                </p>

                            </div>

                        </div>

                    </div>

                    <div className="question-config">

                        <div className="section-heading">

                            <div>

                                <h3>
                                    Question Configuration
                                </h3>

                                <p>
                                    Minimum of{" "}
                                    {MIN_QUESTIONS}{" "}
                                    questions per
                                    difficulty,
                                    per topic.
                                </p>

                            </div>

                        </div>

                        <div className="difficulty-grid">

                            <QuestionInput
                                label="Easy"
                                value={
                                    easyQuestions
                                }
                                setValue={
                                    setEasyQuestions
                                }
                                className="easy"
                            />

                            <QuestionInput
                                label="Medium"
                                value={
                                    mediumQuestions
                                }
                                setValue={
                                    setMediumQuestions
                                }
                                className="medium"
                            />

                            <QuestionInput
                                label="Hard"
                                value={
                                    hardQuestions
                                }
                                setValue={
                                    setHardQuestions
                                }
                                className="hard"
                            />

                        </div>

                        <div className="question-total">

                            <strong>
                                Questions Per Topic
                            </strong>

                            <span>
                                {
                                    easyQuestions +
                                    mediumQuestions +
                                    hardQuestions
                                }
                            </span>

                        </div>

                    </div>

                    <div className="generator-actions">

                        <button
                            type="button"
                            className="generate-secondary-btn"
                            onClick={
                                resetGenerator
                            }
                        >
                            Start Over
                        </button>

                        <button
                            type="button"
                            className="generate-primary-btn"
                            disabled={
                                !validateQuestions() ||
                                isProcessing ||
                                !lessonTitle.trim()
                            }
                            onClick={
                                startGeneration
                            }
                        >
                            {isProcessing
                                ? "Generating..."
                                : "✨ Generate Lesson"}
                        </button>

                    </div>

                </div>
            )}

            {/* ==================================================
                STEP 3
            ================================================== */}

            {step === "processing" && (
                <div className="generator-card processing-card">

                    <div className="ai-loader">

                        <div className="ai-loader-circle">
                            ✨
                        </div>

                    </div>

                    <h2>
                        {generationProgress.currentTopicName ===
                        "Creating assessments..."
                            ? "Creating assessments..."
                            : "Generating your lesson..."}
                    </h2>

                    <p>
                        {generationProgress.currentTopicName ===
                        "Creating assessments..."
                            ? "All questions are complete. Creating and organizing your assessments..."
                            : "AI is generating the lesson, topics, and questions for each topic."}
                    </p>

                    {generationProgress.totalTopics > 0 && (
                        <div
                            className="topic-generation-progress"
                            style={{
                                marginTop: "20px",
                                padding: "16px",
                                borderRadius: "12px",
                                background:
                                    "rgba(255,255,255,0.05)",
                            }}
                        >

                            <strong>
                                {generationProgress.currentTopicName ===
                                "Creating assessments..."
                                    ? "Generating Assessments"
                                    : "Generating Questions"}
                            </strong>

                            <p>
                                {generationProgress.currentTopicName ===
                                "Creating assessments..."
                                    ? "All topics completed"
                                    : (
                                        <>
                                            Topic{" "}
                                            {
                                                generationProgress.currentTopic
                                            }{" "}
                                            of{" "}
                                            {
                                                generationProgress.totalTopics
                                            }
                                        </>
                                    )}
                            </p>

                            {generationProgress.currentTopicName &&
                                generationProgress.currentTopicName !==
                                    "Creating assessments..." && (
                                <p>
                                    <strong>
                                        Current:
                                    </strong>{" "}
                                    {
                                        generationProgress.currentTopicName
                                    }
                                </p>
                            )}

                            <div
                                style={{
                                    width: "100%",
                                    height: "8px",
                                    background:
                                        "rgba(255,255,255,0.1)",
                                    borderRadius:
                                        "10px",
                                    overflow:
                                        "hidden",
                                    marginTop:
                                        "10px",
                                }}
                            >

                                <div
                                    style={{
                                        width:
                                            generationProgress.currentTopicName ===
                                            "Creating assessments..."
                                                ? "100%"
                                                : `${
                                                      generationProgress.totalTopics > 0
                                                          ? (
                                                                generationProgress.completedTopics /
                                                                    generationProgress.totalTopics
                                                            ) *
                                                            100
                                                          : 0
                                                  }%`,
                                        height: "100%",
                                        background:
                                            "currentColor",
                                        transition:
                                            "width 0.3s ease",
                                    }}
                                />

                            </div>

                            <small>
                                {
                                    generationProgress.currentTopicName ===
                                    "Creating assessments..."
                                        ? "Creating assessments from generated questions..."
                                        : (
                                            <>
                                                {
                                                    generationProgress.completedTopics
                                                }{" "}
                                                topic
                                                {generationProgress.completedTopics ===
                                                1
                                                    ? ""
                                                    : "s"}{" "}
                                                completed
                                            </>
                                        )}
                            </small>

                        </div>
                    )}

                    <div className="processing-status">

                        <div className="processing-item">
                            <span>✓</span>
                            Validating uploaded
                            material
                        </div>

                        <div className="processing-item">
                            <span>✓</span>
                            Extracting learning
                            material
                        </div>

                        <div className="processing-item">
                            <span>✓</span>
                            Generating lesson and
                            topics
                        </div>

                        <div className="processing-item">

                            <span>
                                {generationProgress.completedTopics >
                                0
                                    ? "✓"
                                    : (
                                          <span className="processing-dot" />
                                      )}
                            </span>

                            Generating questions
                            per topic

                        </div>

                        <div className="processing-item">

                            <span>
                                {generationProgress.currentTopicName ===
                                "Creating assessments..."
                                    ? "✓"
                                    : (
                                          <span className="processing-dot" />
                                      )}
                            </span>

                            Generating assessments

                        </div>

                    </div>

                    <div className="processing-question-summary">

                        <span>
                            Easy:{" "}
                            <strong>
                                {easyQuestions}
                            </strong>
                        </span>

                        <span>
                            Medium:{" "}
                            <strong>
                                {mediumQuestions}
                            </strong>
                        </span>

                        <span>
                            Hard:{" "}
                            <strong>
                                {hardQuestions}
                            </strong>
                        </span>

                        <span>
                            Per Topic:{" "}
                            <strong>
                                {
                                    easyQuestions +
                                    mediumQuestions +
                                    hardQuestions
                                }
                            </strong>
                        </span>

                    </div>

                </div>
            )}

            {/* ==================================================
                STEP 4
            ================================================== */}

            {step === "preview" &&
                generatedLesson && (
                    <div className="generator-card">

                        <div className="preview-success">

                            <div className="preview-success-icon">
                                ✓
                            </div>

                            <h2>
                                Lesson Ready!
                            </h2>

                            <p>
                                The lesson, topics,
                                questions, and
                                assessments have
                                been generated and
                                saved to the database.
                            </p>

                        </div>

                        <div className="lesson-preview">

                            <span className="preview-label">
                                LESSON
                            </span>

                            <h2>
                                {
                                    generatedLesson.title
                                }
                            </h2>

                            <p>
                                {
                                    generatedLesson.overview
                                }
                            </p>

                            <div className="preview-topics">

                                <h3>
                                    Assignment
                                </h3>

                                <p>
                                    Lesson assigned to
                                    user ID{" "}
                                    <strong>
                                        {
                                            generatedLesson.assignedUserId
                                        }
                                    </strong>
                                </p>

                            </div>

                            <div className="preview-topics">

                                <h3>
                                    Topics
                                </h3>

                                {generatedLesson
                                    .topics
                                    ?.length > 0 ? (
                                    generatedLesson.topics.map(
                                        (
                                            topic,
                                            index
                                        ) => (
                                            <div
                                                className="preview-topic"
                                                key={
                                                    topic.id ||
                                                    index
                                                }
                                            >

                                                <span>
                                                    {index +
                                                        1}
                                                </span>

                                                <div>

                                                    <strong>
                                                        {
                                                            topic.title
                                                        }
                                                    </strong>

                                                    <p>
                                                        {
                                                            topic.description
                                                        }
                                                    </p>

                                                    <small>
                                                        ✓{" "}
                                                        {
                                                            topic.questionCount
                                                        }{" "}
                                                        questions generated
                                                    </small>

                                                </div>

                                            </div>
                                        )
                                    )
                                ) : (
                                    <div className="preview-topic">

                                        <span>
                                            —
                                        </span>

                                        <div>

                                            <strong>
                                                No topics
                                                returned
                                            </strong>

                                            <p>
                                                Check the
                                                generated
                                                lesson data.
                                            </p>

                                        </div>

                                    </div>
                                )}

                            </div>

                            <div className="question-summary">

                                <div>

                                    <strong>
                                        {
                                            generatedLesson
                                                .questions
                                                ?.easy
                                        }
                                    </strong>

                                    <span>
                                        Easy / Topic
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        {
                                            generatedLesson
                                                .questions
                                                ?.medium
                                        }
                                    </strong>

                                    <span>
                                        Medium / Topic
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        {
                                            generatedLesson
                                                .questions
                                                ?.hard
                                        }
                                    </strong>

                                    <span>
                                        Hard / Topic
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        {
                                            generatedLesson
                                                .questions
                                                ?.easy +
                                            generatedLesson
                                                .questions
                                                ?.medium +
                                            generatedLesson
                                                .questions
                                                ?.hard
                                        }
                                    </strong>

                                    <span>
                                        Per Topic
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        {
                                            generatedLesson
                                                .totalQuestionsAllTopics
                                        }
                                    </strong>

                                    <span>
                                        All Topics
                                    </span>

                                </div>

                            </div>

                            <div className="preview-topics">

                                <h3>
                                    Assessments
                                </h3>

                                <p>
                                    {
                                        generatedLesson
                                            .assessments
                                            ?.length || 0
                                    }{" "}
                                    topic assessment
                                    {generatedLesson
                                        .assessments
                                        ?.length === 1
                                        ? ""
                                        : "s"}{" "}
                                    generated.
                                </p>

                                {generatedLesson
                                    .assessments
                                    ?.length > 0 && (
                                    <div
                                        style={{
                                            marginTop:
                                                "12px",
                                        }}
                                    >
                                        {generatedLesson.assessments.map(
                                            (
                                                assessment,
                                                index
                                            ) => (
                                                <div
                                                    key={
                                                        assessment.id ||
                                                        index
                                                    }
                                                    className="preview-topic"
                                                >
                                                    <span>
                                                        {
                                                            index +
                                                            1
                                                        }
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            {
                                                                assessment.title
                                                            }
                                                        </strong>

                                                        <p>
                                                            {
                                                                assessment.total_questions
                                                            }{" "}
                                                            questions
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}

                            </div>

                        </div>

                        <div className="generator-actions">

                            <button
                                type="button"
                                className="generate-secondary-btn"
                                onClick={() =>
                                    setStep(
                                        "configure"
                                    )
                                }
                                disabled={
                                    isSaving
                                }
                            >
                                ← Edit Configuration
                            </button>

                            <button
                                type="button"
                                className="generate-primary-btn"
                                onClick={
                                    saveLesson
                                }
                                disabled={
                                    isSaving
                                }
                            >
                                {isSaving
                                    ? "Saving..."
                                    : "✓ Saved"}
                            </button>

                        </div>

                    </div>
                )}

        </div>
    );
};

// ================================================================
// QUESTION INPUT
// ================================================================

const QuestionInput = ({
    label,
    value,
    setValue,
    className,
}) => {
    const decrease = () => {
        setValue((current) =>
            Math.max(
                MIN_QUESTIONS,
                current - QUESTION_STEP
            )
        );
    };

    const increase = () => {
        setValue(
            (current) =>
                current + QUESTION_STEP
        );
    };

    const handleInputChange = (
        event
    ) => {
        const rawValue =
            event.target.value;

        if (rawValue === "") {
            setValue(
                MIN_QUESTIONS
            );

            return;
        }

        const newValue =
            Number(rawValue);

        if (
            !Number.isFinite(
                newValue
            )
        ) {
            setValue(
                MIN_QUESTIONS
            );

            return;
        }

        setValue(
            Math.max(
                MIN_QUESTIONS,
                Math.floor(
                    newValue
                )
            )
        );
    };

    return (
        <div
            className={`difficulty-card ${className}`}
        >

            <span className="difficulty-label">
                {label}
            </span>

            <div className="question-counter">

                <button
                    type="button"
                    onClick={decrease}
                    disabled={
                        value <=
                        MIN_QUESTIONS
                    }
                    aria-label={`Decrease ${label} questions`}
                >
                    −
                </button>

                <input
                    type="number"
                    min={MIN_QUESTIONS}
                    step={QUESTION_STEP}
                    value={value}
                    onChange={
                        handleInputChange
                    }
                    aria-label={`${label} questions`}
                />

                <button
                    type="button"
                    onClick={increase}
                    aria-label={`Increase ${label} questions`}
                >
                    +
                </button>

            </div>

            <span className="minimum-text">
                Minimum:{" "}
                {MIN_QUESTIONS}
            </span>

        </div>
    );
};

export default GenerateLesson;