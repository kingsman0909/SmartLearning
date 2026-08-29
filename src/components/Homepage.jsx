import React, { useEffect, useMemo, useState } from "react";
import {
  topicData,
  flashCardData,
  practiceProblems,
  assessmentData,
} from "../data/probabilityData.js";

import "../styles/homepage.css";

const LETTERS = ["A", "B", "C", "D"];

const Homepage = () => {
  const [activeSection, setActiveSection] = useState("home");

  // Practice
  const [difficulty, setDifficulty] = useState("medium");
  const [currentPractice, setCurrentPractice] = useState(null);
  const [practiceSelected, setPracticeSelected] = useState(null);
  const [practiceAnswered, setPracticeAnswered] =
    useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Flashcards
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [flashCorrect, setFlashCorrect] = useState(0);
  const [flashWrong, setFlashWrong] = useState(0);
  const [flashAnswered, setFlashAnswered] = useState(
    new Set()
  );

  // Assessments
  const [assessments, setAssessments] = useState(
    () =>
      assessmentData.map((assessment) => ({
        ...assessment,
        questions: assessment.questions.map(
          (question) => ({ ...question })
        ),
      }))
  );

  const [assessmentAnswers, setAssessmentAnswers] =
    useState({});

  const [selectedAssessment, setSelectedAssessment] =
    useState(null);

  // Result
  const [result, setResult] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  // ============================================================
  // TOAST
  // ============================================================

  const showToast = (message, type = "info") => {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // ============================================================
  // CONFETTI
  // ============================================================

  const launchConfetti = () => {
    const container =
      document.createElement("div");

    container.className =
      "confetti-container";

    for (let i = 0; i < 40; i++) {
      const piece =
        document.createElement("div");

      piece.className = "confetti";

      piece.style.left =
        `${Math.random() * 100}%`;

      piece.style.animationDelay =
        `${Math.random() * 0.5}s`;

      container.appendChild(piece);
    }

    document.body.appendChild(container);

    setTimeout(() => {
      container.remove();
    }, 3000);
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const navigateTo = (section) => {
    setActiveSection(section);

    if (section === "flashcards") {
      setFlashFlipped(false);
    }

    if (section === "assessments") {
      setSelectedAssessment(null);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // PRACTICE
  // ============================================================

  const generatePractice = () => {
    const problems =
      practiceProblems[difficulty];

    if (!problems?.length) return;

    const randomIndex =
      Math.floor(
        Math.random() * problems.length
      );

    setCurrentPractice(
      problems[randomIndex]
    );

    setPracticeSelected(null);
    setPracticeAnswered(false);
    setShowSolution(false);
  };

  const handlePracticeAnswer = (index) => {
    if (
      !currentPractice ||
      practiceAnswered
    ) {
      return;
    }

    setPracticeSelected(index);
    setPracticeAnswered(true);

    if (
      index === currentPractice.correct
    ) {
      showToast(
        "✅ Correct! Great job!",
        "success"
      );

      launchConfetti();
    } else {
      showToast(
        "❌ Incorrect. Keep practicing!",
        "error"
      );
    }
  };

  useEffect(() => {
    generatePractice();
  }, []);

  // ============================================================
  // FLASHCARDS
  // ============================================================

  const currentFlashCard =
    flashCardData[flashIndex];

  const flashAccuracy = useMemo(() => {
    const total =
      flashCorrect + flashWrong;

    if (total === 0) return 0;

    return Math.round(
      (flashCorrect / total) * 100
    );
  }, [flashCorrect, flashWrong]);

  const level = useMemo(() => {
    if (flashCorrect >= 15)
      return "Expert";

    if (flashCorrect >= 10)
      return "Advanced";

    if (flashCorrect >= 5)
      return "Intermediate";

    return "Beginner";
  }, [flashCorrect]);

  const handleFlashAnswer = (index) => {
    if (
      flashAnswered.has(flashIndex)
    ) {
      return;
    }

    setFlashAnswered((prev) => {
      const next = new Set(prev);
      next.add(flashIndex);
      return next;
    });

    if (
      index ===
      currentFlashCard.correctAnswer
    ) {
      setFlashCorrect(
        (prev) => prev + 1
      );

      showToast(
        "✅ Correct!",
        "success"
      );

      launchConfetti();
    } else {
      setFlashWrong(
        (prev) => prev + 1
      );

      showToast(
        `❌ Incorrect. Answer: ${
          LETTERS[
            currentFlashCard
              .correctAnswer
          ]
        }`,
        "error"
      );
    }

    setTimeout(() => {
      setFlashFlipped(true);
    }, 500);
  };

  const nextFlashCard = () => {
    if (
      flashIndex <
      flashCardData.length - 1
    ) {
      setFlashIndex(
        (prev) => prev + 1
      );

      setFlashFlipped(false);
    } else {
      showToast(
        "🎉 All cards completed!",
        "success"
      );

      launchConfetti();
    }
  };

  const previousFlashCard = () => {
    if (flashIndex > 0) {
      setFlashIndex(
        (prev) => prev - 1
      );

      setFlashFlipped(false);
    }
  };

  const resetFlashCards = () => {
    if (
      !window.confirm(
        "Reset all flashcard progress?"
      )
    ) {
      return;
    }

    setFlashIndex(0);
    setFlashFlipped(false);
    setFlashCorrect(0);
    setFlashWrong(0);
    setFlashAnswered(new Set());

    showToast(
      "🔄 Flashcards reset!",
      "info"
    );
  };

  const markFlashCorrect = () => {
    if (
      flashAnswered.has(flashIndex)
    ) {
      showToast(
        "Already answered!",
        "info"
      );

      return;
    }

    setFlashAnswered((prev) => {
      const next = new Set(prev);
      next.add(flashIndex);
      return next;
    });

    setFlashCorrect(
      (prev) => prev + 1
    );

    setFlashFlipped(true);

    showToast(
      "✅ Marked correct!",
      "success"
    );

    launchConfetti();
  };

  const markFlashWrong = () => {
    if (
      flashAnswered.has(flashIndex)
    ) {
      showToast(
        "Already answered!",
        "info"
      );

      return;
    }

    setFlashAnswered((prev) => {
      const next = new Set(prev);
      next.add(flashIndex);
      return next;
    });

    setFlashWrong(
      (prev) => prev + 1
    );

    setFlashFlipped(true);

    showToast(
      "❌ Marked wrong",
      "error"
    );
  };

  // ============================================================
  // ASSESSMENTS
  // ============================================================

  const getAnswers = (assessmentId) => {
    return (
      assessmentAnswers[
        assessmentId
      ] || {}
    );
  };

  const handleAssessmentAnswer = (
    assessmentId,
    questionIndex,
    answerIndex
  ) => {
    const answers =
      getAnswers(assessmentId);

    if (
      answers[questionIndex] !==
      undefined
    ) {
      return;
    }

    setAssessmentAnswers(
      (prev) => ({
        ...prev,
        [assessmentId]: {
          ...(
            prev[assessmentId] || {}
          ),
          [questionIndex]:
            answerIndex,
        },
      })
    );

    setAssessments((prev) =>
      prev.map((assessment) =>
        assessment.id ===
        assessmentId
          ? {
              ...assessment,
              status:
                "in-progress",
            }
          : assessment
      )
    );
  };

  const startAssessment = (
    assessmentId
  ) => {
    setSelectedAssessment(
      assessmentId
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const closeAssessment = () => {
    setSelectedAssessment(null);
  };

  const submitAssessment = (
    assessmentId
  ) => {
    const assessment =
      assessments.find(
        (item) =>
          item.id === assessmentId
      );

    if (!assessment) return;

    const answers =
      getAnswers(assessmentId);

    let correct = 0;

    assessment.questions.forEach(
      (question, index) => {
        if (
          answers[index] ===
          question.correct
        ) {
          correct++;
        }
      }
    );

    const total =
      assessment.questions.length;

    const score = Math.round(
      (correct / total) * 100
    );

    const status =
      score >= 70
        ? "passed"
        : "failed";

    setAssessments((prev) =>
      prev.map((item) =>
        item.id === assessmentId
          ? {
              ...item,
              score,
              status,
            }
          : item
      )
    );

    setResult({
      assessment,
      correct,
      total,
      score,
    });

    if (score >= 70) {
      launchConfetti();
    }
  };

  const closeResult = () => {
    setResult(null);
    setSelectedAssessment(null);
  };

  // ============================================================
  // STATS
  // ============================================================

  const stats = {
    lessons: topicData.length,

    problems: Object.values(
      practiceProblems
    ).reduce(
      (total, problems) =>
        total + problems.length,
      0
    ),

    flashcards:
      flashCardData.length,

    assessments:
      assessments.length,
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <div className="app-container">
        <div className='homepage'>
        {/* HEADER */}

        <header className="header">

          <div className="logo">
            <span>🎲</span>
            <h1>ProbLearn</h1>
          </div>

          <div className="header-stats">

            <span className="level-badge">
              ⭐ Level: {level}
            </span>

            <span className="score-display">
              ✅ {flashCorrect}/
              {flashCorrect +
                flashWrong}
            </span>

          </div>

          <nav className="nav-buttons">

            {[
              ["home", "🏠 Home"],
              ["learn", "📚 Learn"],
              [
                "practice",
                "✏️ Practice",
              ],
              [
                "flashcards",
                "🃏 Flash Cards",
              ],
              [
                "assessments",
                "📝 Assessments",
              ],
            ].map(
              ([section, label]) => (
                <button
                  key={section}
                  className={`nav-btn ${
                    activeSection ===
                    section
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    navigateTo(
                      section
                    )
                  }
                >
                  {label}
                </button>
              )
            )}

          </nav>

        </header>

        {/* HOME */}

        {activeSection ===
          "home" && (

          <section className="section active">

            <div className="hero">

              <h2>
                Learn, practice, and
                assess your understanding
                of probability concepts
              </h2>

              <p>
                Master probability with
                interactive flashcards,
                practice problems, and
                assessments
              </p>

              <div className="quick-stats">

                <StatCard
                  value={stats.lessons}
                  label="📚 Lessons"
                  onClick={() =>
                    navigateTo("learn")
                  }
                />

                <StatCard
                  value={stats.problems}
                  label="💡 Practice Problems"
                  onClick={() =>
                    navigateTo(
                      "practice"
                    )
                  }
                />

                <StatCard
                  value={
                    stats.flashcards
                  }
                  label="🃏 Flash Cards"
                  onClick={() =>
                    navigateTo(
                      "flashcards"
                    )
                  }
                />

                <StatCard
                  value={
                    stats.assessments
                  }
                  label="📝 Assessments"
                  onClick={() =>
                    navigateTo(
                      "assessments"
                    )
                  }
                />

              </div>

            </div>

            <div className="feature-grid">

              <FeatureCard
                icon="📖"
                title="Learn"
                description="Explore probability concepts with interactive examples and explanations"
                onClick={() =>
                  navigateTo("learn")
                }
              />

              <FeatureCard
                icon="✏️"
                title="Practice"
                description="Solve problems with instant feedback and step-by-step solutions"
                onClick={() =>
                  navigateTo(
                    "practice"
                  )
                }
              />

              <FeatureCard
                icon="🃏"
                title="Flash Cards"
                description="Review key concepts with interactive flashcards and track your progress"
                onClick={() =>
                  navigateTo(
                    "flashcards"
                  )
                }
              />

              <FeatureCard
                icon="📊"
                title="Assessments"
                description="Test your knowledge with graded quizzes and track your progress"
                onClick={() =>
                  navigateTo(
                    "assessments"
                  )
                }
              />

            </div>

          </section>
        )}

        {/* LEARN */}

        {activeSection ===
          "learn" && (

          <section className="section active">

            <h2 className="section-title">
              📚 Learning Topics
            </h2>

            <div className="content-grid">

              {topicData.map(
                (topic) => (
                  <div
                    className="content-card"
                    key={topic.title}
                    onClick={() =>
                      showToast(
                        `📖 ${topic.title}`,
                        "info"
                      )
                    }
                  >

                    <h3>
                      {topic.title}
                    </h3>

                    <p>
                      {topic.desc}
                    </p>

                    <span
                      className={`difficulty-tag ${topic.difficulty}`}
                    >
                      {topic.difficulty}
                    </span>

                  </div>
                )
              )}

            </div>

          </section>
        )}

        {/* PRACTICE */}

        {activeSection ===
          "practice" && (

          <section className="section active">

            <h2 className="section-title">
              ✏️ Practice Problems
            </h2>

            <div className="practice-controls">

              <select
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(
                    e.target.value
                  );

                  setTimeout(
                    generatePractice,
                    0
                  );
                }}
              >
                <option value="easy">
                  🟢 Easy
                </option>

                <option value="medium">
                  🟡 Medium
                </option>

                <option value="hard">
                  🔴 Hard
                </option>
              </select>

              <button
                className="btn-primary"
                onClick={
                  generatePractice
                }
              >
                🔄 New Problem
              </button>

              <button
                className="btn-secondary"
                onClick={() =>
                  setShowSolution(
                    true
                  )
                }
              >
                💡 Show Solution
              </button>

            </div>

            <div className="practice-problem">

              {currentPractice && (
                <>
                  <div className="problem-text">
                    {currentPractice.question}
                  </div>

                  <div className="practice-options">

                    {currentPractice.options.map(
                      (
                        option,
                        index
                      ) => (
                        <button
                          key={option}
                          className={`practice-opt ${
                            practiceAnswered
                              ? index ===
                                currentPractice.correct
                                ? "correct"
                                : index ===
                                  practiceSelected
                                ? "wrong"
                                : ""
                              : ""
                          }`}
                          onClick={() =>
                            handlePracticeAnswer(
                              index
                            )
                          }
                          disabled={
                            practiceAnswered
                          }
                        >
                          {
                            LETTERS[
                              index
                            ]
                          }
                          . {option}
                        </button>
                      )
                    )}

                  </div>

                  {practiceAnswered && (
                    <div className="feedback-text">

                      {practiceSelected ===
                      currentPractice.correct
                        ? "✅ Correct!"
                        : `❌ Incorrect. Correct answer: ${
                            LETTERS[
                              currentPractice.correct
                            ]
                          }`}

                    </div>
                  )}

                  {showSolution && (
                    <div className="solution-area show">
                      💡{" "}
                      {
                        currentPractice.solution
                      }
                    </div>
                  )}
                  
                </>
              )}

            </div>

          </section>
        )}

        {/* FLASHCARDS */}

        {activeSection ===
          "flashcards" && (

          <section className="section active">

            <h2 className="section-title">
              🃏 Flash Cards
            </h2>

            <div className="progress-bar-container">

              <div
                className="progress-bar"
                style={{
                  width: `${
                    ((flashIndex +
                      1) /
                      flashCardData.length) *
                    100
                  }%`,
                }}
              />

            </div>

            <div className="flash-card-container">

              <div
                className={`flash-card ${
                  flashFlipped
                    ? "flipped"
                    : ""
                }`}
                onClick={() =>
                  setFlashFlipped(
                    (prev) =>
                      !prev
                  )
                }
              >

                <div className="card-front">

                  <span className="category-tag">
                    📊{" "}
                    {
                      currentFlashCard.category
                    }
                  </span>

                  <span className="card-number">
                    {flashIndex + 1}/
                    {
                      flashCardData.length
                    }
                  </span>

                  <div className="question">
                    {
                      currentFlashCard.question
                    }
                  </div>

                  <div className="flash-options">

                    {currentFlashCard.options.map(
                      (
                        option,
                        index
                      ) => (
                        <button
                          key={option}
                          className="option-btn"
                          disabled={flashAnswered.has(
                            flashIndex
                          )}
                          onClick={(
                            e
                          ) => {
                            e.stopPropagation();

                            handleFlashAnswer(
                              index
                            );
                          }}
                        >
                          <span className="letter">
                            {
                              LETTERS[
                                index
                              ]
                            }
                          </span>

                          {option}
                        </button>
                      )
                    )}

                  </div>

                  <div className="click-hint">
                    👆 Click card or tap an option
                  </div>

                </div>

                <div className="card-back">

                  <div className="answer-label">
                    💡 Answer
                  </div>

                  <div className="answer">

                    {
                      LETTERS[
                        currentFlashCard
                          .correctAnswer
                      ]
                    }
                    .{" "}
                    {
                      currentFlashCard.options[
                        currentFlashCard
                          .correctAnswer
                      ]
                    }

                  </div>

                  <div className="explanation">
                    {
                      currentFlashCard.explanation
                    }
                  </div>

                </div>

              </div>

            </div>

            <div className="card-counter">
              Card {flashIndex + 1} of{" "}
              {flashCardData.length}
            </div>

            <div className="controls">

              <button
                className="btn-secondary"
                onClick={
                  previousFlashCard
                }
              >
                ◀ Previous
              </button>

              <button
                className="btn-primary"
                onClick={() =>
                  setFlashFlipped(
                    (prev) =>
                      !prev
                  )
                }
              >
                🔄 Flip
              </button>

              <button
                className="btn-secondary"
                onClick={
                  nextFlashCard
                }
              >
                Next ▶
              </button>

              <button
                className="btn-success"
                onClick={
                  markFlashCorrect
                }
              >
                ✅ Correct
              </button>

              <button
                className="btn-danger"
                onClick={
                  markFlashWrong
                }
              >
                ❌ Wrong
              </button>

              <button
                className="btn-secondary"
                onClick={
                  resetFlashCards
                }
              >
                🔄 Reset
              </button>

            </div>

            <div className="stats-grid">

              <StatItem
                value={
                  flashCardData.length
                }
                label="Total Cards"
              />

              <StatItem
                value={flashCorrect}
                label="✅ Correct"
              />

              <StatItem
                value={flashWrong}
                label="❌ Wrong"
              />

              <StatItem
                value={`${flashAccuracy}%`}
                label="🎯 Accuracy"
              />

            </div>

          </section>
        )}

        {/* ASSESSMENTS */}

        {activeSection ===
          "assessments" && (

          <section className="section active">

            {!selectedAssessment ? (

              <>
                <h2 className="section-title">
                  📝 Assessments
                </h2>

                <div className="assessment-grid">

                  {assessments.map(
                    (assessment) => {

                      const answers =
                        getAnswers(
                          assessment.id
                        );

                      const answered =
                        Object.keys(
                          answers
                        ).length;

                      const total =
                        assessment.questions.length;

                      const progress =
                        Math.round(
                          (answered /
                            total) *
                            100
                        );

                      return (
                        <div
                          key={
                            assessment.id
                          }
                          className="assessment-card"
                          onClick={() =>
                            startAssessment(
                              assessment.id
                            )
                          }
                        >

                          <h3>
                            {
                              assessment.icon
                            }{" "}
                            {
                              assessment.title
                            }
                          </h3>

                          <p>
                            {
                              assessment.description
                            }
                          </p>

                          <span
                            className={`difficulty-tag ${assessment.difficulty}`}
                          >
                            {
                              assessment.difficulty
                            }
                          </span>

                          <div className="meta">
                            📝{" "}
                            {
                              assessment.questions.length
                            }{" "}
                            questions
                          </div>

                          {assessment.status ===
                            "passed" && (
                            <span className="status-tag passed">
                              ✅ Passed:{" "}
                              {
                                assessment.score
                              }%
                            </span>
                          )}

                          {assessment.status ===
                            "failed" && (
                            <span className="status-tag failed">
                              ❌ Failed:{" "}
                              {
                                assessment.score
                              }%
                            </span>
                          )}

                          {assessment.status ===
                            "pending" && (
                            <span className="status-tag pending">
                              ⏳ Not Attempted
                            </span>
                          )}

                          {assessment.status ===
                            "in-progress" && (
                            <span className="status-tag in-progress">
                              ⏳{" "}
                              {
                                answered
                              }
                              /
                              {
                                total
                              }
                            </span>
                          )}

                          {progress > 0 &&
                            progress <
                              100 && (
                              <div className="assessment-progress">
                                <div
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>
                            )}

                        </div>
                      );
                    }
                  )}

                </div>
              </>

            ) : (

              <AssessmentDetail
                assessment={assessments.find(
                  (item) =>
                    item.id ===
                    selectedAssessment
                )}
                answers={getAnswers(
                  selectedAssessment
                )}
                onBack={
                  closeAssessment
                }
                onAnswer={
                  handleAssessmentAnswer
                }
                onSubmit={
                  submitAssessment
                }
              />

            )}

          </section>
        )}

      </div>

      {/* RESULT */}

      {result && (

        <div className="result-overlay show">

          <div className="result-card">

            <div className="score-circle">
              {result.score}%
            </div>

            <h2>
              {result.score >= 70
                ? "🎉 Great Job!"
                : "💪 Keep Practicing!"}
            </h2>

            <p className="sub-text">
              You scored{" "}
              {result.correct} out of{" "}
              {result.total} questions
              correct.
            </p>

            <div className="details">

              <div className="item">
                <div className="num">
                  {result.correct}
                </div>
                <div className="label">
                  ✅ Correct
                </div>
              </div>

              <div className="item">
                <div className="num">
                  {result.total -
                    result.correct}
                </div>
                <div className="label">
                  ❌ Wrong
                </div>
              </div>

            </div>

            <button
              className="btn-primary"
              onClick={
                closeResult
              }
            >
              Continue Learning
            </button>

          </div>

        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div
          className={`toast ${toast.type}`}
        >
          {toast.message}
        </div>
      )}
      </div>
    </>
  );
};

/* ============================================================
   SMALL COMPONENTS
   ============================================================ */

const StatCard = ({
  value,
  label,
  onClick,
}) => (
  <div
    className="stat-card"
    onClick={onClick}
  >
    <h3>{value}</h3>
    <p>{label}</p>
  </div>
);

const FeatureCard = ({
  icon,
  title,
  description,
  onClick,
}) => (
  <div
    className="feature-card"
    onClick={onClick}
  >
    <div className="feature-icon">
      {icon}
    </div>

    <h3>{title}</h3>

    <p>{description}</p>
  </div>
);

const StatItem = ({
  value,
  label,
}) => (
  <div className="stat-item">
    <div className="value">
      {value}
    </div>

    <div className="label">
      {label}
    </div>
  </div>
);

/* ============================================================
   ASSESSMENT DETAIL
   ============================================================ */

const AssessmentDetail = ({
  assessment,
  answers,
  onBack,
  onAnswer,
  onSubmit,
}) => {
  if (!assessment) return null;

  const total =
    assessment.questions.length;

  const answered =
    Object.keys(answers).length;

  const allAnswered =
    answered === total;

  return (
    <div className="assessment-detail">

      <button
        className="back-btn"
        onClick={onBack}
      >
        ← Back to Assessments
      </button>

      <div className="assessment-content">

        <div className="title-section">

          <h2>
            {assessment.icon}{" "}
            {assessment.title}
          </h2>

          <span
            className={`difficulty-tag ${assessment.difficulty}`}
          >
            {assessment.difficulty}
          </span>

          <span>
            {answered}/{total} answered
          </span>

        </div>

        <p className="assessment-description">
          {assessment.description}
        </p>

        {assessment.questions.map(
          (question, questionIndex) => {

            const selected =
              answers[
                questionIndex
              ];

            const hasAnswered =
              selected !== undefined;

            return (
              <div
                className="question-item"
                key={questionIndex}
              >

                <div className="q-number">
                  Question{" "}
                  {questionIndex + 1}{" "}
                  of {total}
                </div>

                <div className="q-text">
                  {
                    question.question
                  }
                </div>

                <div className="options">

                  {question.options.map(
                    (
                      option,
                      optionIndex
                    ) => {

                      const isCorrect =
                        optionIndex ===
                        question.correct;

                      const isSelected =
                        optionIndex ===
                        selected;

                      return (
                        <button
                          key={option}
                          className={`option-btn ${
                            hasAnswered &&
                            isCorrect
                              ? "correct"
                              : ""
                          } ${
                            hasAnswered &&
                            isSelected &&
                            !isCorrect
                              ? "wrong"
                              : ""
                          }`}
                          disabled={
                            hasAnswered
                          }
                          onClick={() =>
                            onAnswer(
                              assessment.id,
                              questionIndex,
                              optionIndex
                            )
                          }
                        >
                          <span className="letter">
                            {
                              LETTERS[
                                optionIndex
                              ]
                            }
                          </span>

                          {option}
                        </button>
                      );
                    }
                  )}

                </div>

                {hasAnswered && (
                  <div className="feedback show">

                    {selected ===
                    question.correct
                      ? "✅ Correct!"
                      : "❌ Incorrect."}

                    <div className="explanation">
                      💡{" "}
                      {
                        question.explanation
                      }
                    </div>

                  </div>
                )}

              </div>
            );
          }
        )}

        <div className="submit-area">

          <button
            className="btn-primary"
            disabled={!allAnswered}
            onClick={() =>
              onSubmit(
                assessment.id
              )
            }
          >
            {allAnswered
              ? "📊 Submit Assessment"
              : "Answer all questions to submit"}
          </button>

        </div>

      </div>

    </div>
  );
};

export default Homepage;