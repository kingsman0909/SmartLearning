import React, {
  useEffect,
  useState,
} from "react";

import "../styles/homepage.css";

import Header from "../components/Header";
import HomeSection from "../components/HomeSection";
import LearnSection from "../components/LearnSection";
import PracticeSection from "../components/PracticeSection";
import FlashcardsSection from "../components/FlashcardsSection";
import AssessmentsSection from "../components/AssessmentsSection";
import ProfileModal from "../components/ProfileModal";
import ResultModal from "../components/ResultModal";
import Toast from "../components/Toast";

// ============================================================
// CONSTANTS
// ============================================================

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const LETTERS = [
  "A",
  "B",
  "C",
  "D",
];

const FLASHCARD_STORAGE_KEY =
  "problearn_flashcards_progress";

// Passing rule:
// 5/10 and above = PASS
// 4/10 and below = FAIL
const PASSING_SCORE = 50;

// ============================================================
// API
// ============================================================

const apiFetch = async (
  endpoint,
  options = {}
) => {
  const token =
    localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...(options.headers || {}),
      },
    }
  );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

// ============================================================
// USER NORMALIZER
// ============================================================

const normalizeUser = (
  response
) => {
  if (!response) {
    return null;
  }

  const candidates = [
    response?.data?.user,
    response?.user,
    response?.data,
    response,
  ];

  const found =
    candidates.find(
      (item) =>
        item &&
        typeof item ===
          "object" &&
        !Array.isArray(item) &&
        (
          item.username !==
            undefined ||
          item.alias !==
            undefined ||
          item.id !==
            undefined
        )
    );

  if (!found) {
    return null;
  }

  return {
    ...found,

    username:
      found.username ??
      found.user?.username ??
      "",

    alias:
      found.alias ??
      found.user?.alias ??
      "",
  };
};

// ============================================================
// QUESTION NORMALIZER
// ============================================================

const normalizeQuestion = (
  question
) => {
  if (!question) {
    return null;
  }

  let options = [];

  if (
    Array.isArray(
      question.options
    )
  ) {
    options =
      question.options;
  } else {
    options = [
      question.choice_a,
      question.choice_b,
      question.choice_c,
      question.choice_d,
    ].filter(
      (value) =>
        value !== null &&
        value !== undefined
    );
  }

  return {
    ...question,
    options,
  };
};

// ============================================================
// POINTS
// ============================================================

const getEarnedPoints = (
  data
) => {
  return (
    Number(
      data?.score_earned ??
        data?.points_earned ??
        data?.pointsEarned ??
        0
    ) || 0
  );
};

// ============================================================
// CORRECT ANSWER
// ============================================================

const getCorrectAnswer = (
  result,
  question
) => {
  return (
    result?.correct_answer ??
    result?.correctAnswer ??
    result?.answer ??
    question?.correct_answer ??
    question?.correctAnswer ??
    null
  );
};

// ============================================================
// STATS
// ============================================================

const normalizeStats = (
  data
) => {
  const stats =
    data || {};

  const score =
    Number(
      stats.score ??
        stats.total_score ??
        0
    ) || 0;

  const correct =
    Number(
      stats.correct ??
        stats.questions_correct ??
        0
    ) || 0;

  const totalAnswered =
    Number(
      stats.totalAnswered ??
        stats.questions_answered ??
        0
    ) || 0;

  const successRate =
    Number(
      stats.successRate ??
        stats.success_rate ??
        0
    ) || 0;

  let level =
    stats.level ??
    "Level 1";

  if (
    level === null ||
    level === undefined ||
    level === ""
  ) {
    level = "Level 1";
  }

  if (
    typeof level ===
      "string" &&
    !level
      .toLowerCase()
      .startsWith("level")
  ) {
    if (
      !isNaN(
        Number(level)
      )
    ) {
      level =
        `Level ${level}`;
    }
  }

  if (
    typeof level ===
    "number"
  ) {
    level =
      `Level ${level}`;
  }

  return {
    score,
    correct,

    wrong: Math.max(
      0,
      totalAnswered -
        correct
    ),

    totalAnswered,

    successRate,

    level,
  };
};

// ============================================================
// ASSESSMENT NORMALIZER
// ============================================================

const normalizeAssessment =
  (assessment) => {
    if (!assessment) {
      return null;
    }

    const questions =
      Array.isArray(
        assessment.questions
      )
        ? assessment.questions
            .map(
              normalizeQuestion
            )
            .filter(Boolean)
        : [];

    let correct = Number(
      assessment.correct ??
        assessment.questions_correct ??
        0
    );

    if (
      !Number.isFinite(
        correct
      )
    ) {
      correct = 0;
    }

    let total =
      Number(
        assessment.total ??
          assessment.question_count ??
          questions.length
      );

    if (
      !Number.isFinite(
        total
      ) ||
      total < 0
    ) {
      total =
        questions.length;
    }

    let score = Number(
      assessment.score ??
        assessment.percentage ??
        0
    );

    if (
      !Number.isFinite(
        score
      )
    ) {
      score = 0;
    }

    let status =
      assessment.status ??
      null;

    /*
      If backend already gives a status,
      preserve it.

      Otherwise derive it from score.
    */
    if (
      !status &&
      assessment.attempted
    ) {
      status =
        score >=
        PASSING_SCORE
          ? "passed"
          : "failed";
    }

    return {
      ...assessment,

      questions,

      correct,

      total,

      score,

      status,
    };
  };

// ============================================================
// FLASHCARD STORAGE
// ============================================================

const getSavedFlashcardProgress =
  () => {
    try {
      const saved =
        localStorage.getItem(
          FLASHCARD_STORAGE_KEY
        );

      if (!saved) {
        return {
          answered: {},
          results: {},
          index: 0,
        };
      }

      const parsed =
        JSON.parse(saved);

      return {
        answered:
          parsed?.answered ||
          {},

        results:
          parsed?.results ||
          {},

        index:
          Number(
            parsed?.index
          ) || 0,
      };
    } catch {
      return {
        answered: {},
        results: {},
        index: 0,
      };
    }
  };

const saveFlashcardProgress = ({
  answered,
  results,
  index,
}) => {
  try {
    localStorage.setItem(
      FLASHCARD_STORAGE_KEY,
      JSON.stringify({
        answered,
        results,
        index,
      })
    );
  } catch (error) {
    console.error(
      "Unable to save flashcard progress:",
      error
    );
  }
};

// ============================================================
// HOMEPAGE
// ============================================================

const Homepage = () => {

  // ==========================================================
  // SECTION
  // ==========================================================

  const [
    activeSection,
    setActiveSection,
  ] = useState("home");

  // ==========================================================
  // USER
  // ==========================================================

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    showProfile,
    setShowProfile,
  ] = useState(false);

  const [
    showUserMenu,
    setShowUserMenu,
  ] = useState(false);

  const [
    userLoading,
    setUserLoading,
  ] = useState(false);

  // ==========================================================
  // DATA
  // ==========================================================

  const [
    topics,
    setTopics,
  ] = useState([]);

  const [
    practiceProblems,
    setPracticeProblems,
  ] = useState([]);

  const [
    flashCards,
    setFlashCards,
  ] = useState([]);

  const [
    assessments,
    setAssessments,
  ] = useState([]);

  // ==========================================================
  // STATS
  // ==========================================================

  const [
    userStats,
    setUserStats,
  ] = useState({
    score: 0,
    correct: 0,
    wrong: 0,
    totalAnswered: 0,
    successRate: 0,
    level: "Level 1",
  });

  // ==========================================================
  // LOADING
  // ==========================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  // ==========================================================
  // PRACTICE
  // ==========================================================

  const [
    difficulty,
    setDifficulty,
  ] = useState("medium");

  const [
    currentPractice,
    setCurrentPractice,
  ] = useState(null);

  const [
    practiceSelected,
    setPracticeSelected,
  ] = useState(null);

  const [
    practiceAnswered,
    setPracticeAnswered,
  ] = useState(false);

  const [
    practiceResult,
    setPracticeResult,
  ] = useState(null);

  const [
    showSolution,
    setShowSolution,
  ] = useState(false);

  // ==========================================================
  // FLASHCARDS
  // ==========================================================

  const [
    flashIndex,
    setFlashIndex,
  ] = useState(0);

  const [
    flashFlipped,
    setFlashFlipped,
  ] = useState(false);

  const [
    flashCorrect,
    setFlashCorrect,
  ] = useState(0);

  const [
    flashWrong,
    setFlashWrong,
  ] = useState(0);

  const [
    flashAnswered,
    setFlashAnswered,
  ] = useState({});

  const [
    flashResults,
    setFlashResults,
  ] = useState({});

  // ==========================================================
  // ASSESSMENTS
  // ==========================================================

  const [
    assessmentAnswers,
    setAssessmentAnswers,
  ] = useState({});

  const [
    selectedAssessment,
    setSelectedAssessment,
  ] = useState(null);

  const [
    assessmentSubmitting,
    setAssessmentSubmitting,
  ] = useState(false);

  // ==========================================================
  // RESULT / TOAST
  // ==========================================================

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    toast,
    setToast,
  ] = useState(null);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = (
    message,
    type = "info"
  ) => {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // ==========================================================
  // CONFETTI
  // ==========================================================

  const launchConfetti = () => {
    const container =
      document.createElement(
        "div"
      );

    container.className =
      "confetti-container";

    for (
      let i = 0;
      i < 40;
      i++
    ) {
      const piece =
        document.createElement(
          "div"
        );

      piece.className =
        "confetti";

      piece.style.left =
        `${Math.random() * 100}%`;

      piece.style.animationDelay =
        `${Math.random() * 0.5}s`;

      container.appendChild(
        piece
      );
    }

    document.body.appendChild(
      container
    );

    setTimeout(() => {
      container.remove();
    }, 3000);
  };

  // ==========================================================
  // LOAD HOMEPAGE DATA
  // ==========================================================

  const loadHomepageData =
    async () => {
      try {
        setLoading(true);
        setError(null);

        const results =
          await Promise.allSettled([
            apiFetch("/user"),

            apiFetch("/topics"),

            apiFetch(
              "/questions/practice"
            ),

            apiFetch(
              "/questions/flashcards"
            ),

            apiFetch(
              "/assessments"
            ),

            apiFetch("/progress"),
          ]);

        const [
          userResult,
          topicsResult,
          practiceResult,
          flashcardResult,
          assessmentResult,
          progressResult,
        ] = results;

        // ======================================================
        // USER
        // ======================================================

        if (
          userResult.status ===
          "fulfilled"
        ) {
          const userData =
            normalizeUser(
              userResult.value
            );

          if (userData) {
            setUser(userData);
          }
        } else {
          console.error(
            "User request failed:",
            userResult.reason
          );
        }

        // ======================================================
        // TOPICS
        // ======================================================

        if (
          topicsResult.status ===
          "fulfilled"
        ) {
          const topicData =
            topicsResult.value?.data ??
            topicsResult.value ??
            [];

          setTopics(
            Array.isArray(
              topicData
            )
              ? topicData
              : []
          );
        }

        // ======================================================
        // PRACTICE
        // ======================================================

        if (
          practiceResult.status ===
          "fulfilled"
        ) {
          const practiceData =
            practiceResult.value?.data ??
            practiceResult.value ??
            [];

          setPracticeProblems(
            Array.isArray(
              practiceData
            )
              ? practiceData
                  .map(
                    normalizeQuestion
                  )
                  .filter(Boolean)
              : []
          );
        }

        // ======================================================
        // FLASHCARDS
        // ======================================================

        if (
          flashcardResult.status ===
          "fulfilled"
        ) {
          const flashData =
            flashcardResult.value?.data ??
            flashcardResult.value ??
            [];

          const normalizedFlashcards =
            Array.isArray(
              flashData
            )
              ? flashData
                  .map(
                    normalizeQuestion
                  )
                  .filter(Boolean)
              : [];

          setFlashCards(
            normalizedFlashcards
          );

          const saved =
            getSavedFlashcardProgress();

          setFlashAnswered(
            saved.answered ||
              {}
          );

          setFlashResults(
            saved.results ||
              {}
          );

          if (
            normalizedFlashcards.length >
            0
          ) {
            setFlashIndex(
              Math.min(
                saved.index ||
                  0,

                normalizedFlashcards.length -
                  1
              )
            );
          }

          let correctCount = 0;
          let wrongCount = 0;

          Object.values(
            saved.results ||
              {}
          ).forEach(
            (item) => {
              if (
                item?.correct ===
                true
              ) {
                correctCount++;
              }

              if (
                item?.correct ===
                false
              ) {
                wrongCount++;
              }
            }
          );

          setFlashCorrect(
            correctCount
          );

          setFlashWrong(
            wrongCount
          );
        }

        // ======================================================
        // ASSESSMENTS
        // ======================================================

        if (
          assessmentResult.status ===
          "fulfilled"
        ) {
          const assessmentData =
            assessmentResult.value?.data ??
            assessmentResult.value ??
            [];

          const normalizedAssessments =
            Array.isArray(
              assessmentData
            )
              ? assessmentData
                  .map(
                    normalizeAssessment
                  )
                  .filter(Boolean)
              : [];

          setAssessments(
            normalizedAssessments
          );
        } else {
          console.error(
            "Assessment request failed:",
            assessmentResult.reason
          );
        }

        // ======================================================
        // PROGRESS
        // ======================================================

        if (
          progressResult.status ===
          "fulfilled"
        ) {
          const progressData =
            progressResult.value?.data ??
            progressResult.value ??
            {};

          setUserStats(
            normalizeStats(
              progressData
            )
          );
        }

      } catch (err) {
        console.error(
          "Homepage loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load learning data."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadHomepageData();
  }, []);

  // ==========================================================
  // SAVE FLASHCARD
  // ==========================================================

  useEffect(() => {
    if (loading) {
      return;
    }

    saveFlashcardProgress({
      answered:
        flashAnswered,

      results:
        flashResults,

      index:
        flashIndex,
    });
  }, [
    flashAnswered,
    flashResults,
    flashIndex,
    loading,
  ]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navigateTo = (
    section
  ) => {
    setActiveSection(section);
    setShowUserMenu(false);

    if (
      section ===
      "flashcards"
    ) {
      setFlashFlipped(false);
    }

    if (
      section ===
      "assessments"
    ) {
      setSelectedAssessment(
        null
      );
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==========================================================
  // PRACTICE
  // ==========================================================

  const generatePractice = () => {
    const filtered =
      practiceProblems.filter(
        (problem) =>
          problem.difficulty ===
          difficulty
      );

    if (!filtered.length) {
      showToast(
        "No questions available for this difficulty.",
        "error"
      );

      setCurrentPractice(null);
      return;
    }

    const index =
      Math.floor(
        Math.random() *
          filtered.length
      );

    setCurrentPractice(
      filtered[index]
    );

    setPracticeSelected(null);
    setPracticeAnswered(false);
    setPracticeResult(null);
    setShowSolution(false);
  };

  useEffect(() => {
    if (
      !loading &&
      practiceProblems.length
    ) {
      generatePractice();
    }
  }, [
    loading,
    practiceProblems.length,
  ]);

  // ==========================================================
  // PRACTICE ANSWER
  // ==========================================================

  const handlePracticeAnswer =
    async (answerIndex) => {
      if (
        !currentPractice ||
        practiceAnswered
      ) {
        return;
      }

      try {
        const answer =
          LETTERS[
            answerIndex
          ];

        setPracticeSelected(
          answerIndex
        );

        const response =
          await apiFetch(
            "/practice/answer",
            {
              method: "POST",

              body: JSON.stringify({
                question_id:
                  currentPractice.id,

                answer,
              }),
            }
          );

        const resultData =
          response?.data ??
          response;

        setPracticeAnswered(
          true
        );

        setPracticeResult(
          resultData
        );

        const points =
          getEarnedPoints(
            resultData
          );

        if (
          resultData.correct
        ) {
          showToast(
            `✅ Correct! +${points} points`,
            "success"
          );

          launchConfetti();
        } else {
          showToast(
            "❌ Incorrect. Keep practicing!",
            "error"
          );
        }

        if (
          resultData.progress
        ) {
          setUserStats(
            normalizeStats(
              resultData.progress
            )
          );
        }

      } catch (err) {
        setPracticeAnswered(
          false
        );

        setPracticeSelected(
          null
        );

        showToast(
          err.message ||
            "Unable to submit answer.",
          "error"
        );
      }
    };

  // ==========================================================
  // FLASHCARD DERIVED
  // ==========================================================

  const currentFlashCard =
    flashCards[
      flashIndex
    ] || null;

  const currentFlashCardId =
    currentFlashCard?.id ??
    null;

  const currentFlashResult =
    currentFlashCardId
      ? flashResults[
          currentFlashCardId
        ] || null
      : null;

  const currentFlashAnswered =
    currentFlashCardId
      ? Boolean(
          flashAnswered[
            currentFlashCardId
          ]
        )
      : false;

  // ==========================================================
  // FLASHCARD ANSWER
  // ==========================================================

  const handleFlashAnswer =
    async (index) => {
      if (
        !currentFlashCard ||
        currentFlashAnswered
      ) {
        return;
      }

      try {
        const answer =
          LETTERS[index];

        const response =
          await apiFetch(
            "/flashcards/answer",
            {
              method: "POST",

              body: JSON.stringify({
                question_id:
                  currentFlashCard.id,

                answer,
              }),
            }
          );

        const resultData =
          response?.data ??
          response;

        const cardId =
          currentFlashCard.id;

        setFlashAnswered(
          (previous) => ({
            ...previous,

            [cardId]: true,
          })
        );

        setFlashResults(
          (previous) => ({
            ...previous,

            [cardId]:
              resultData,
          })
        );

        if (
          resultData.correct
        ) {
          setFlashCorrect(
            (previous) =>
              previous + 1
          );

          showToast(
            `✅ Correct! +${getEarnedPoints(
              resultData
            )} points`,
            "success"
          );

          launchConfetti();
        } else {
          setFlashWrong(
            (previous) =>
              previous + 1
          );

          showToast(
            "❌ Incorrect!",
            "error"
          );
        }

        if (
          resultData.progress
        ) {
          setUserStats(
            normalizeStats(
              resultData.progress
            )
          );
        }

      } catch (err) {
        showToast(
          err.message ||
            "Unable to submit flashcard answer.",
          "error"
        );
      }
    };

  // ==========================================================
  // FLASHCARD NAVIGATION
  // ==========================================================

  const nextFlashCard =
    () => {
      if (
        flashIndex <
        flashCards.length - 1
      ) {
        setFlashIndex(
          (previous) =>
            previous + 1
        );

        setFlashFlipped(
          false
        );
      } else {
        showToast(
          "🎉 All cards completed!",
          "success"
        );

        launchConfetti();
      }
    };

  const previousFlashCard =
    () => {
      if (
        flashIndex > 0
      ) {
        setFlashIndex(
          (previous) =>
            previous - 1
        );

        setFlashFlipped(
          false
        );
      }
    };

  const resetFlashCards =
    () => {
      if (
        !window.confirm(
          "Reset this flashcard session?"
        )
      ) {
        return;
      }

      setFlashIndex(0);
      setFlashFlipped(false);
      setFlashCorrect(0);
      setFlashWrong(0);
      setFlashAnswered({});
      setFlashResults({});

      localStorage.removeItem(
        FLASHCARD_STORAGE_KEY
      );

      showToast(
        "🔄 Flashcards reset!",
        "info"
      );
    };

  // ==========================================================
  // ASSESSMENT ANSWERS
  // ==========================================================

  const getAnswers = (
    assessmentId
  ) => {
    return (
      assessmentAnswers[
        assessmentId
      ] || {}
    );
  };

  // ==========================================================
  // HANDLE ASSESSMENT ANSWER
  // ==========================================================

  const handleAssessmentAnswer =
    (
      assessmentId,
      questionId,
      answer
    ) => {
      const answers =
        getAnswers(
          assessmentId
        );

      /*
        Don't allow changing an answer
        after it has been recorded.
      */
      if (
        answers[questionId] !==
        undefined
      ) {
        return;
      }

      setAssessmentAnswers(
        (previous) => ({
          ...previous,

          [assessmentId]: {
            ...(previous[
              assessmentId
            ] || {}),

            [questionId]:
              answer,
          },
        })
      );
    };

  // ==========================================================
  // RESET ASSESSMENT
  // ==========================================================

  const resetAssessmentAnswers =
    (assessmentId) => {
      setAssessmentAnswers(
        (previous) => {
          const updated = {
            ...previous,
          };

          delete updated[
            assessmentId
          ];

          return updated;
        }
      );
    };

  // ==========================================================
  // START / RETRY ASSESSMENT
  // ==========================================================

  const startAssessment =
    async (assessmentId) => {
      try {
        const existing =
          assessments.find(
            (item) =>
              item.id ===
              assessmentId
          );

        /*
          If this is a failed assessment,
          automatically clear the previous
          answers before starting again.
        */
        if (
          existing?.status ===
          "failed"
        ) {
          resetAssessmentAnswers(
            assessmentId
          );
        }

        const response =
          await apiFetch(
            `/assessments/${assessmentId}`
          );

        const assessment =
          response?.data ??
          response;

        const normalizedAssessment =
          normalizeAssessment(
            assessment
          );

        setAssessments(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                assessmentId
                  ? {
                      ...item,

                      ...normalizedAssessment,

                      questions:
                        normalizedAssessment?.questions ??
                        item.questions,
                    }
                  : item
            )
        );

        setSelectedAssessment(
          assessmentId
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

      } catch (err) {
        console.error(
          "Start assessment error:",
          err
        );

        showToast(
          err.message ||
            "Unable to load assessment.",
          "error"
        );
      }
    };

  // ==========================================================
  // CLOSE ASSESSMENT
  // ==========================================================

  const closeAssessment =
    () => {
      setSelectedAssessment(
        null
      );
    };

  // ==========================================================
  // SUBMIT ASSESSMENT
  // ==========================================================

  const submitAssessment =
    async (assessmentId) => {
      const assessment =
        assessments.find(
          (item) =>
            item.id ===
            assessmentId
        );

      if (!assessment) {
        return;
      }

      const answers =
        getAnswers(
          assessmentId
        );

      const total =
        assessment.questions
          ?.length || 0;

      const answered =
        Object.keys(
          answers
        ).length;

      if (
        total === 0
      ) {
        showToast(
          "This assessment has no questions.",
          "error"
        );

        return;
      }

      if (
        answered !== total
      ) {
        showToast(
          `Please answer all questions first. ${answered}/${total} answered.`,
          "error"
        );

        return;
      }

      try {
        setAssessmentSubmitting(
          true
        );

        const formattedAnswers =
          Object.entries(
            answers
          ).map(
            ([
              questionId,
              answer,
            ]) => ({
              question_id:
                Number(
                  questionId
                ),

              answer,
            })
          );

        const response =
          await apiFetch(
            `/assessments/${assessmentId}/submit`,
            {
              method: "POST",

              body: JSON.stringify({
                answers:
                  formattedAnswers,
              }),
            }
          );

        const resultData =
          response?.data ??
          response;

        // ====================================================
        // GET CORRECT / TOTAL
        // ====================================================

        const correct =
          Number(
            resultData.correct ??
              resultData.questions_correct ??
              0
          );

        const resultTotal =
          Number(
            resultData.total ??
              resultData.question_count ??
              total
          );

        /*
          IMPORTANT:

          Always calculate the percentage
          from correct / total.

          Example:

          1 / 10 = 10%

          NOT 1/10 as "10 correct".
        */
        const calculatedScore =
          resultTotal > 0
            ? Math.round(
                (
                  correct /
                  resultTotal
                ) *
                  100
              )
            : 0;

        /*
          Backend score is allowed if it
          looks like a percentage, but
          correct/total is our source of
          truth for the assessment result.
        */
        const score =
          calculatedScore;

        /*
          Passing:

          5/10 = 50% = PASS
          4/10 = 40% = FAIL
        */
        const passed =
          score >=
          PASSING_SCORE;

        const status =
          passed
            ? "passed"
            : "failed";

        const pointsEarned =
          getEarnedPoints(
            resultData
          );

        // ====================================================
        // UPDATE USER STATS
        // ====================================================

        if (
          resultData.progress
        ) {
          setUserStats(
            normalizeStats(
              resultData.progress
            )
          );
        }

        // ====================================================
        // UPDATE ASSESSMENT CARD
        // ====================================================

        setAssessments(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                assessmentId
                  ? {
                      ...item,

                      correct,

                      total:
                        resultTotal,

                      score,

                      status,

                      attempted:
                        true,
                    }
                  : item
            )
        );

        // ====================================================
        // RESULT MODAL
        // ====================================================

        setResult({
          assessment,

          correct,

          total:
            resultTotal,

          score,

          pointsEarned,

          status,

          passed,
        });

        // ====================================================
        // CONFETTI ONLY WHEN PASSED
        // ====================================================

        if (passed) {
          launchConfetti();

          showToast(
            `🎉 Passed! ${correct}/${resultTotal} correct (${score}%)`,
            "success"
          );
        } else {
          showToast(
            `❌ Failed. ${correct}/${resultTotal} correct (${score}%). Try again!`,
            "error"
          );
        }

      } catch (err) {
        console.error(
          "Assessment submission error:",
          err
        );

        showToast(
          err.message ||
            "Unable to submit assessment.",
          "error"
        );
      } finally {
        setAssessmentSubmitting(
          false
        );
      }
    };

  // ==========================================================
  // PROFILE
  // ==========================================================

  const refreshProfile =
    async () => {
      try {
        setUserLoading(true);

        const [
          userResponse,
          progressResponse,
        ] = await Promise.all([
          apiFetch("/user"),
          apiFetch("/progress"),
        ]);

        const refreshedUser =
          normalizeUser(
            userResponse
          );

        if (refreshedUser) {
          setUser(
            (previous) => ({
              ...previous,
              ...refreshedUser,
            })
          );
        }

        const progressData =
          progressResponse?.data ??
          progressResponse ??
          {};

        setUserStats(
          normalizeStats(
            progressData
          )
        );

        showToast(
          "Profile updated!",
          "success"
        );

      } catch (err) {
        console.error(
          "Profile refresh error:",
          err
        );

        showToast(
          err.message ||
            "Unable to refresh profile.",
          "error"
        );
      } finally {
        setUserLoading(
          false
        );
      }
    };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {
      try {
        const token =
          localStorage.getItem(
            "token"
          );

        if (token) {
          try {
            await apiFetch(
              "/logout",
              {
                method: "POST",
              }
            );
          } catch {
            // Ignore logout errors
          }
        }
      } finally {
        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          FLASHCARD_STORAGE_KEY
        );

        setUser(null);

        window.location.href =
          "/";
      }
    };

  // ==========================================================
  // PROFILE VALUES
  // ==========================================================

  const displayName =
    user?.alias?.trim() ||
    user?.username?.trim() ||
    "Learner";

  const username =
    user?.username?.trim() ||
    "user";

  const userInitial =
    displayName
      ?.charAt(0)
      ?.toUpperCase() ||
    "U";

  // ==========================================================
  // STATS
  // ==========================================================

  const stats = {
    lessons:
      topics.length,

    problems:
      practiceProblems.length,

    flashcards:
      flashCards.length,

    assessments:
      assessments.length,
  };

  const levelNumber =
    Number(
      String(
        userStats.level ||
          "Level 1"
      ).replace(/\D/g, "")
    ) || 1;

  const levelProgress =
    Math.min(
      100,
      userStats.score % 100 ||
        0
    );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="app-container">
        <div className="homepage">
          <section className="section active">
            <div className="loading-container">
              <h2>
                🎲 Loading ProbLearn...
              </h2>

              <p>
                Preparing your
                learning environment.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <div className="app-container">
        <div className="homepage">
          <section className="section active">
            <div className="loading-container">
              <h2>
                ⚠️ Unable to load
                ProbLearn
              </h2>

              <p>
                {error}
              </p>

              <button
                className="btn-primary"
                onClick={
                  loadHomepageData
                }
              >
                🔄 Try Again
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <div className="app-container">

      <div className="homepage">

        {/* ==================================================
            HEADER
        ================================================== */}

        <Header
          activeSection={
            activeSection
          }

          navigateTo={
            navigateTo
          }

          userInitial={
            userInitial
          }

          displayName={
            displayName
          }

          username={
            username
          }

          userStats={
            userStats
          }

          showUserMenu={
            showUserMenu
          }

          setShowUserMenu={
            setShowUserMenu
          }

          openProfile={() => {
            setShowUserMenu(
              false
            );

            setShowProfile(
              true
            );
          }}

          handleLogout={
            handleLogout
          }
        />

        {/* ==================================================
            HOME
        ================================================== */}

        {activeSection ===
          "home" && (
          <HomeSection
            displayName={
              displayName
            }

            userStats={
              userStats
            }

            levelNumber={
              levelNumber
            }

            levelProgress={
              levelProgress
            }

            stats={
              stats
            }

            navigateTo={
              navigateTo
            }
          />
        )}

        {/* ==================================================
            LEARN
        ================================================== */}

        {activeSection ===
          "learn" && (
          <LearnSection
            topics={
              topics
            }

            showToast={
              showToast
            }
          />
        )}

        {/* ==================================================
            PRACTICE
        ================================================== */}

        {activeSection ===
          "practice" && (
          <PracticeSection
            difficulty={
              difficulty
            }

            setDifficulty={
              setDifficulty
            }

            generatePractice={
              generatePractice
            }

            currentPractice={
              currentPractice
            }

            practiceSelected={
              practiceSelected
            }

            practiceAnswered={
              practiceAnswered
            }

            practiceResult={
              practiceResult
            }

            showSolution={
              showSolution
            }

            setShowSolution={
              setShowSolution
            }

            handlePracticeAnswer={
              handlePracticeAnswer
            }

            getCorrectAnswer={
              getCorrectAnswer
            }

            getEarnedPoints={
              getEarnedPoints
            }

            LETTERS={
              LETTERS
            }
          />
        )}

        {/* ==================================================
            FLASHCARDS
        ================================================== */}

        {activeSection ===
          "flashcards" && (
          <FlashcardsSection
            flashCards={
              flashCards
            }

            flashIndex={
              flashIndex
            }

            flashFlipped={
              flashFlipped
            }

            setFlashFlipped={
              setFlashFlipped
            }

            flashCorrect={
              flashCorrect
            }

            flashWrong={
              flashWrong
            }

            flashAnswered={
              flashAnswered
            }

            flashResults={
              flashResults
            }

            currentFlashCard={
              currentFlashCard
            }

            currentFlashResult={
              currentFlashResult
            }

            currentFlashAnswered={
              currentFlashAnswered
            }

            handleFlashAnswer={
              handleFlashAnswer
            }

            nextFlashCard={
              nextFlashCard
            }

            previousFlashCard={
              previousFlashCard
            }

            resetFlashCards={
              resetFlashCards
            }

            getCorrectAnswer={
              getCorrectAnswer
            }

            getEarnedPoints={
              getEarnedPoints
            }

            LETTERS={
              LETTERS
            }
          />
        )}

        {/* ==================================================
            ASSESSMENTS
        ================================================== */}

        {activeSection ===
          "assessments" && (
          <AssessmentsSection
            assessments={
              assessments
            }

            selectedAssessment={
              selectedAssessment
            }

            getAnswers={
              getAnswers
            }

            startAssessment={
              startAssessment
            }

            assessmentSubmitting={
              assessmentSubmitting
            }

            closeAssessment={
              closeAssessment
            }

            handleAssessmentAnswer={
              handleAssessmentAnswer
            }

            submitAssessment={
              submitAssessment
            }

            normalizeQuestion={
              normalizeQuestion
            }

            LETTERS={
              LETTERS
            }

            PASSING_SCORE={
              PASSING_SCORE
            }
          />
        )}

      </div>

      {/* ======================================================
          PROFILE MODAL
      ====================================================== */}

      <ProfileModal
        showProfile={
          showProfile
        }

        setShowProfile={
          setShowProfile
        }

        user={
          user
        }

        userInitial={
          userInitial
        }

        displayName={
          displayName
        }

        username={
          username
        }

        userStats={
          userStats
        }

        levelProgress={
          levelProgress
        }

        flashCorrect={
          flashCorrect
        }

        topics={
          topics
        }

        userLoading={
          userLoading
        }

        refreshProfile={
          refreshProfile
        }

        handleLogout={
          handleLogout
        }
      />

      {/* ======================================================
          RESULT MODAL
      ====================================================== */}

      <ResultModal
        result={
          result
        }

        closeResult={() => {
          setResult(null);

          /*
            Close the assessment after
            viewing the result.
          */
          setSelectedAssessment(
            null
          );
        }}
      />

      {/* ======================================================
          TOAST
      ====================================================== */}

      <Toast
        toast={
          toast
        }
      />

    </div>
  );
};

export default Homepage;