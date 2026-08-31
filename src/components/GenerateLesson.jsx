import React, { useRef, useState } from "react";
import "../styles/homepage.css";

const MIN_QUESTIONS = 20;
const QUESTION_STEP = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Backend currently accepts PDF only.
const ALLOWED_EXTENSIONS = [".pdf"];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const GenerateLesson = ({
    onLessonGenerated,
    showToast,
}) => {
    const fileInputRef = useRef(null);

    // ============================================================
    // STATE
    // ============================================================

    const [file, setFile] = useState(null);

    // upload -> configure -> processing -> preview
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

        // Automatically use filename as initial lesson title.
        setLessonTitle(
            getFileNameWithoutExtension(
                selectedFile.name
            )
        );

        // Make sure we stay on upload step.
        setStep("upload");

        // Clear previous generated lesson.
        setGeneratedLesson(null);
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

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // ============================================================
    // FILE NAME
    // ============================================================

    const getFileNameWithoutExtension = (
        fileName
    ) => {
        if (!fileName) {
            return "Untitled Lesson";
        }

        return fileName.replace(
            /\.[^/.]+$/,
            ""
        );
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
    //
    // IMPORTANT:
    // THIS DOES NOT CALL THE AI.
    //
    // It only moves the user to configuration.
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
    // STEP 2 -> STEP 3
    //
    // THIS is where the AI generation actually starts.
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

        setError("");
        setIsProcessing(true);
        setStep("processing");

        try {
            const token = getToken();

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please log in again."
                );
            }

            // ====================================================
            // FORM DATA
            // ====================================================

            const formData = new FormData();

            formData.append("file", file);

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

            // ====================================================
            // DEBUG
            // ====================================================

            console.log(
                "Sending lesson generation request..."
            );

            console.log({
                file: file.name,
                lesson_title: lessonTitle,
                easy_questions: easyQuestions,
                medium_questions: mediumQuestions,
                hard_questions: hardQuestions,
                total_questions:
                    easyQuestions +
                    mediumQuestions +
                    hardQuestions,
            });

            // ====================================================
            // AI GENERATION REQUEST
            // ====================================================

            const response = await fetch(
                `${API_BASE_URL}/ai/generate-lesson`,
                {
                    method: "POST",

                    headers: {
                        Accept:
                            "application/json",

                        Authorization:
                            `Bearer ${token}`,
                    },

                    body: formData,
                }
            );

            // ====================================================
            // READ RESPONSE
            // ====================================================

            const responseText =
                await response.text();

            let data;

            try {
                data =
                    responseText
                        ? JSON.parse(
                              responseText
                          )
                        : {};
            } catch (jsonError) {
                console.error(
                    "Invalid JSON response:",
                    responseText
                );

                throw new Error(
                    "The server returned an invalid response."
                );
            }

            console.log(
                "AI lesson generation response:",
                data
            );

            // ====================================================
            // BACKEND ERROR
            // ====================================================

            if (!response.ok) {
                console.error(
                    "Backend error:",
                    data
                );

                const backendMessage =
                    data?.message ||
                    data?.error ||
                    "Failed to generate lesson.";

                throw new Error(
                    backendMessage
                );
            }

            // ====================================================
            // GENERATION FAILURE
            // ====================================================

            if (!data?.success) {
                throw new Error(
                    data?.message ||
                        "Lesson generation failed."
                );
            }

            // ====================================================
            // BACKEND ALREADY SAVED LESSON
            // ====================================================

            const savedLesson =
                data?.data;

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
            // NORMALIZE BACKEND DATA
            // ====================================================

            const normalizedTopics =
                Array.isArray(
                    savedLesson.topics
                )
                    ? savedLesson.topics.map(
                          (topic) => ({
                              id: topic.id,

                              title:
                                  topic.name,

                              name:
                                  topic.name,

                              description:
                                  topic.description ||
                                  "",

                              questions:
                                  Array.isArray(
                                      topic.questions
                                  )
                                      ? topic.questions
                                      : [],

                              assessment:
                                  topic.assessment ||
                                  null,
                          })
                      )
                    : [];

            const normalizedAssessments =
                Array.isArray(
                    savedLesson.topics
                )
                    ? savedLesson.topics
                          .map(
                              (topic) =>
                                  topic.assessment
                          )
                          .filter(Boolean)
                    : [];

            const normalizedLesson = {
                id: savedLesson.id,

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
                    easy: easyQuestions,
                    medium: mediumQuestions,
                    hard: hardQuestions,
                },

                totalQuestions:
                    easyQuestions +
                    mediumQuestions +
                    hardQuestions,

                assessments:
                    normalizedAssessments,

                raw: savedLesson,
            };

            // ====================================================
            // UPDATE STATE
            // ====================================================

            setGeneratedLesson(
                normalizedLesson
            );

            setLessonTitle(
                normalizedLesson.title
            );

            // ====================================================
            // MOVE TO PREVIEW
            // ====================================================

            setStep("preview");

            notify(
                "Lesson generated and saved successfully!",
                "success"
            );

            // ====================================================
            // PARENT CALLBACK
            // ====================================================

            if (
                typeof onLessonGenerated ===
                "function"
            ) {
                try {
                    onLessonGenerated(
                        normalizedLesson
                    );
                } catch (callbackError) {
                    console.error(
                        "onLessonGenerated error:",
                        callbackError
                    );
                }
            }
        } catch (err) {
            console.error(
                "Lesson generation error:",
                err
            );

            setStep("configure");

            showError(
                err?.message ||
                    "Unable to generate and save the lesson."
            );
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================
    // SAVE LESSON
    //
    // Backend already saves the lesson during generation.
    // This button only confirms that fact.
    // ============================================================

    const saveLesson = async (event) => {
        event?.preventDefault();
        event?.stopPropagation();

        if (!generatedLesson || isSaving) {
            return;
        }

        setIsSaving(true);
        setError("");

        try {
            console.log(
                "Lesson already saved in database:",
                generatedLesson
            );

            notify(
                "Lesson is already saved successfully.",
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

            {/* ==================================================
                HEADER
            ================================================== */}

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

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
                <div
                    className="generator-error"
                    role="alert"
                >
                    <span>⚠️</span>

                    <p>{error}</p>

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

            {/* ==================================================
                STEP INDICATOR
            ================================================== */}

            <div className="generator-steps">

                {/* STEP 1 */}

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

                    <p>Upload</p>
                </div>

                <div className="step-line" />

                {/* STEP 2 */}

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

                    <p>Configure</p>
                </div>

                <div className="step-line" />

                {/* STEP 3 */}

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

                    <p>Generate</p>
                </div>

                <div className="step-line" />

                {/* STEP 4 */}

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

                    <p>Preview</p>
                </div>
            </div>

            {/* ==================================================
                STEP 1 — UPLOAD
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

                    {/* UPLOAD ZONE */}

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

                    {/* HIDDEN FILE INPUT */}

                    <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept=".pdf"
                        onChange={
                            handleFileChange
                        }
                    />

                    {/* ACTION */}

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
                STEP 2 — CONFIGURE
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

                    {/* ==================================================
                        LESSON TITLE
                    ================================================== */}

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

                    {/* ==================================================
                        UPLOADED MATERIAL
                    ================================================== */}

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

                    {/* ==================================================
                        QUESTION CONFIGURATION
                    ================================================== */}

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
                                    difficulty.
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

                        {/* TOTAL */}

                        <div className="question-total">
                            <strong>
                                Total Questions
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

                    {/* ==================================================
                        ACTIONS
                    ================================================== */}

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
                STEP 3 — PROCESSING
            ================================================== */}

            {step === "processing" && (
                <div className="generator-card processing-card">

                    <div className="ai-loader">

                        <div className="ai-loader-circle">
                            ✨
                        </div>

                    </div>

                    <h2>
                        Generating your lesson...
                    </h2>

                    <p>
                        Your material is being
                        analyzed by AI. This may
                        take a while depending on
                        the number of questions
                        requested.
                    </p>

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
                            <span className="processing-dot" />

                            Generating lesson and
                            questions
                        </div>

                        <div className="processing-item">
                            <span className="processing-dot" />

                            Creating topic
                            assessments
                        </div>

                        <div className="processing-item">
                            <span className="processing-dot" />

                            Saving lesson
                            to database
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
                            Total:{" "}
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
                STEP 4 — PREVIEW
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
                                The lesson has
                                already been
                                generated and saved
                                to the database.
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

                            {/* ==================================================
                                TOPICS
                            ================================================== */}

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
                                                        {
                                                            topic.questions
                                                                ?.length ||
                                                            0
                                                        }{" "}
                                                        practice
                                                        questions
                                                        {" • "}
                                                        {topic.assessment
                                                            ?.questions
                                                            ?.length ||
                                                            0}{" "}
                                                        assessment
                                                        questions
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

                            {/* ==================================================
                                QUESTION SUMMARY
                            ================================================== */}

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
                                        Easy
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
                                        Medium
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
                                        Hard
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        {
                                            generatedLesson
                                                .totalQuestions
                                        }
                                    </strong>

                                    <span>
                                        Total
                                    </span>
                                </div>

                            </div>

                            {/* ==================================================
                                ASSESSMENTS
                            ================================================== */}

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

                            </div>

                        </div>

                        {/* ==================================================
                            ACTIONS
                        ================================================== */}

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
            setValue(MIN_QUESTIONS);
            return;
        }

        const newValue =
            Number(rawValue);

        if (!Number.isFinite(newValue)) {
            setValue(MIN_QUESTIONS);
            return;
        }

        setValue(
            Math.max(
                MIN_QUESTIONS,
                Math.floor(newValue)
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