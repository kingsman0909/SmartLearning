import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/$/, "");

const LETTERS = ["A", "B", "C", "D"];

const FLASHCARD_STORAGE_KEY =
  "problearn_flashcards_progress";

const OLD_CACHE_PREFIX =
  "problearn_homepage_cache";

const PASSING_SCORE = 60;

// ============================================================
// AUTH
// ============================================================

const getAuthToken = () => {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("access_token")
  );
};

// ============================================================
// API FETCH
// ============================================================

const apiFetch = async (
  endpoint,
  options = {}
) => {
  const token = getAuthToken();

  console.log(
    `[ProbLearn API] REQUEST → ${endpoint}`,
    {
      method: options.method || "GET",
      hasToken: Boolean(token),
    }
  );

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(options.headers || {}),
      },
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  console.log(
    `[ProbLearn API] RESPONSE ← ${endpoint}`,
    {
      status: response.status,
      ok: response.ok,
      data,
    }
  );

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
// RESPONSE HELPERS
// ============================================================

const getArrayData = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.questions)) {
    return response.questions;
  }

  if (Array.isArray(response?.data?.questions)) {
    return response.data.questions;
  }

  if (Array.isArray(response?.assessments)) {
    return response.assessments;
  }

  if (Array.isArray(response?.data?.assessments)) {
    return response.data.assessments;
  }

  if (Array.isArray(response?.topics)) {
    return response.topics;
  }

  if (Array.isArray(response?.data?.topics)) {
    return response.data.topics;
  }

  if (Array.isArray(response?.lessons)) {
    return response.lessons;
  }

  if (Array.isArray(response?.data?.lessons)) {
    return response.data.lessons;
  }

  return [];
};

const getObjectData = (response) => {
  if (
    response?.data &&
    typeof response.data === "object" &&
    !Array.isArray(response.data)
  ) {
    return response.data;
  }

  if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response)
  ) {
    return response;
  }

  return {};
};

// ============================================================
// LESSON DATA EXTRACTOR
// ============================================================

const extractLessons = (response) => {
  let lessons = [];

  if (Array.isArray(response)) {
    lessons = response;
  } else if (Array.isArray(response?.lessons)) {
    lessons = response.lessons;
  } else if (Array.isArray(response?.data?.lessons)) {
    lessons = response.data.lessons;
  } else if (Array.isArray(response?.data)) {
    lessons = response.data;
  }

  return Array.isArray(lessons)
    ? lessons
    : [];
};

// ============================================================
// TOPIC DATA EXTRACTOR
// ============================================================

const extractTopicsFromLessons = (
  lessons
) => {
  if (!Array.isArray(lessons)) {
    return [];
  }

  const result = [];

  lessons.forEach((lesson) => {
    if (!Array.isArray(lesson?.topics)) {
      return;
    }

    lesson.topics.forEach((topic) => {
      result.push({
        ...topic,
        lesson_id:
          topic.lesson_id ??
          lesson.id,
      });
    });
  });

  return result;
};

// ============================================================
// ASSESSMENT DATA EXTRACTOR
// ============================================================

const extractAssessmentsFromLessons = (
  lessons
) => {
  if (!Array.isArray(lessons)) {
    return [];
  }

  const assessments = [];

  lessons.forEach((lesson) => {
    if (!Array.isArray(lesson?.topics)) {
      return;
    }

    lesson.topics.forEach((topic) => {
      if (
        !Array.isArray(
          topic?.assessments
        )
      ) {
        return;
      }

      topic.assessments.forEach(
        (assessment) => {
          assessments.push({
            ...assessment,
            topic_id:
              assessment.topic_id ??
              topic.id,
          });
        }
      );
    });
  });

  return assessments;
};

// ============================================================
// USER NORMALIZER
// ============================================================

const normalizeUser = (response) => {
  if (!response) {
    return null;
  }

  const candidates = [
    response?.data?.user,
    response?.user,
    response?.data,
    response,
  ];

  const found = candidates.find(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (
        item.username !== undefined ||
        item.alias !== undefined ||
        item.id !== undefined
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

  const options =
    Array.isArray(question.options)
      ? question.options
      : [
          question.choice_a,
          question.choice_b,
          question.choice_c,
          question.choice_d,
        ].filter(
          (value) =>
            value !== null &&
            value !== undefined
        );

  return {
    ...question,
    options,
  };
};

// ============================================================
// POINTS
// ============================================================

const getEarnedPoints = (data) =>
  Number(
    data?.score_earned ??
      data?.points_earned ??
      data?.pointsEarned ??
      0
  ) || 0;

// ============================================================
// CORRECT ANSWER
// ============================================================

const getCorrectAnswer = (
  result,
  question
) =>
  result?.correct_answer ??
  result?.correctAnswer ??
  result?.answer ??
  question?.correct_answer ??
  question?.correctAnswer ??
  null;

// ============================================================
// STATS NORMALIZER
// ============================================================

const normalizeStats = (data) => {
  const stats = data || {};

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
    stats.level ||
    "Level 1";

  if (typeof level === "number") {
    level = `Level ${level}`;
  } else if (
    typeof level === "string" &&
    !level
      .toLowerCase()
      .startsWith("level")
  ) {
    const numericLevel =
      Number(level);

    if (
      Number.isFinite(numericLevel)
    ) {
      level =
        `Level ${numericLevel}`;
    }
  }

  return {
    score,
    correct,
    wrong: Math.max(
      0,
      totalAnswered - correct
    ),
    totalAnswered,
    successRate,
    level,
  };
};

// ============================================================
// ASSESSMENT NORMALIZER
// ============================================================

const normalizeAssessment = (
  assessment
) => {
  if (!assessment) {
    return null;
  }

  const questions =
    Array.isArray(
      assessment.questions
    )
      ? assessment.questions
          .map(normalizeQuestion)
          .filter(Boolean)
      : [];

  let correct = Number(
    assessment.correct ??
      assessment.questions_correct ??
      0
  );

  if (!Number.isFinite(correct)) {
    correct = 0;
  }

  let total = Number(
    assessment.total ??
      assessment.total_questions ??
      assessment.question_count ??
      questions.length
  );

  if (
    !Number.isFinite(total) ||
    total < 0
  ) {
    total = questions.length;
  }

  let score = Number(
    assessment.score ??
      assessment.percentage ??
      0
  );

  if (!Number.isFinite(score)) {
    score = 0;
  }

  let status =
    assessment.status ?? null;

  if (
    !status &&
    assessment.attempted
  ) {
    status =
      score >= PASSING_SCORE
        ? "passed"
        : "failed";
  }

  const locked =
    assessment.locked === true ||
    status === "passed";

  return {
    ...assessment,

    questions,

    correct,
    total,
    score,
    status,
    locked,

    passed:
      assessment.passed === true ||
      status === "passed",

    can_retake:
      assessment.can_retake ??
      status !== "passed",
  };
};

// ============================================================
// FLASHCARD STORAGE
// ============================================================

const EMPTY_FLASHCARD_PROGRESS = {
  answered: {},
  results: {},
  index: 0,
};

const getSavedFlashcardProgress =
  () => {
    try {
      const saved =
        localStorage.getItem(
          FLASHCARD_STORAGE_KEY
        );

      if (!saved) {
        return {
          ...EMPTY_FLASHCARD_PROGRESS,
        };
      }

      const parsed =
        JSON.parse(saved);

      return {
        answered:
          parsed?.answered || {},

        results:
          parsed?.results || {},

        index:
          Number(
            parsed?.index
          ) || 0,
      };
    } catch {
      return {
        ...EMPTY_FLASHCARD_PROGRESS,
      };
    }
  };

const saveFlashcardProgress = (
  progress
) => {
  try {
    localStorage.setItem(
      FLASHCARD_STORAGE_KEY,
      JSON.stringify(progress)
    );
  } catch (error) {
    console.warn(
      "Unable to save flashcard progress:",
      error
    );
  }
};

// ============================================================
// CLEAR OLD HOMEPAGE CACHE
// ============================================================

const clearOldHomepageCaches = () => {
  try {
    const keys =
      Object.keys(localStorage).filter(
        (key) =>
          key.startsWith(
            OLD_CACHE_PREFIX
          )
      );

    if (keys.length > 0) {
      console.log(
        "[ProbLearn Cache] Removing old homepage caches:",
        keys
      );

      keys.forEach((key) => {
        localStorage.removeItem(key);
      });

      console.log(
        "[ProbLearn Cache] Old homepage caches removed."
      );
    }
  } catch (error) {
    console.warn(
      "[ProbLearn Cache] Unable to clear old caches:",
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
    lessons,
    setLessons,
  ] = useState([]);

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

  const savedFlashProgress =
    useMemo(
      () =>
        getSavedFlashcardProgress(),
      []
    );

  const [
    flashIndex,
    setFlashIndex,
  ] = useState(
    savedFlashProgress.index
  );

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
  ] = useState(
    savedFlashProgress.answered
  );

  const [
    flashResults,
    setFlashResults,
  ] = useState(
    savedFlashProgress.results
  );

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

  const toastTimerRef =
    useRef(null);

  const loadRequestRef =
    useRef(0);

  const initialLoadRef =
    useRef(false);

  // ==========================================================
  // CLEAR OLD CACHE ON MOUNT
  // ==========================================================

  useEffect(() => {
    clearOldHomepageCaches();
  }, []);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast =
    useCallback(
      (
        message,
        type = "info"
      ) => {
        if (
          toastTimerRef.current
        ) {
          clearTimeout(
            toastTimerRef.current
          );
        }

        setToast({
          message,
          type,
        });

        toastTimerRef.current =
          setTimeout(() => {
            setToast(null);
          }, 2500);
      },
      []
    );

  useEffect(() => {
    return () => {
      if (
        toastTimerRef.current
      ) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);

  // ==========================================================
  // CONFETTI
  // ==========================================================

  const launchConfetti =
    useCallback(() => {
      const container =
        document.createElement(
          "div"
        );

      container.className =
        "confetti-container";

      const fragment =
        document.createDocumentFragment();

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

        fragment.appendChild(
          piece
        );
      }

      container.appendChild(
        fragment
      );

      document.body.appendChild(
        container
      );

      setTimeout(() => {
        container.remove();
      }, 3000);
    }, []);

  // ==========================================================
  // LOAD HOMEPAGE DATA
  //
  // IMPORTANT:
  // SERVER IS THE ONLY SOURCE OF TRUTH.
  //
  // NO HOMEPAGE CACHE.
  // ==========================================================

  const loadHomepageData =
    useCallback(
      async (
        forceRefresh = false
      ) => {
        const requestId =
          ++loadRequestRef.current;

        console.group(
          `%c[ProbLearn] Homepage Load #${requestId}`,
          "font-weight:bold"
        );

        console.log(
          "API URL:",
          API_URL
        );

        console.log(
          "Force refresh:",
          forceRefresh
        );

        console.log(
          "Auth token exists:",
          Boolean(
            getAuthToken()
          )
        );

        try {
          setError(null);
          setLoading(true);

          // ==================================================
          // USER
          // ==================================================

          let currentUser =
            null;

          try {
            const cachedUserRaw =
              localStorage.getItem(
                "problearn_cached_user"
              );

            if (cachedUserRaw) {
              const cachedUser =
                JSON.parse(
                  cachedUserRaw
                );

              if (
                cachedUser?.id
              ) {
                currentUser =
                  cachedUser;

                console.log(
                  "[USER] Cached user fallback:",
                  cachedUser
                );
              }
            }
          } catch (cacheError) {
            console.warn(
              "[USER] Invalid cached user:",
              cacheError
            );
          }

          // Always ask server for current user.

          try {
            const userResponse =
              await apiFetch(
                "/user"
              );

            console.log(
              "[USER] Raw response:",
              userResponse
            );

            const fetchedUser =
              normalizeUser(
                userResponse
              );

            console.log(
              "[USER] Normalized:",
              fetchedUser
            );

            if (
              fetchedUser?.id
            ) {
              currentUser =
                fetchedUser;

              setUser(
                fetchedUser
              );

              localStorage.setItem(
                "problearn_cached_user",
                JSON.stringify(
                  fetchedUser
                )
              );
            }
          } catch (userError) {
            console.error(
              "[USER] Server request failed:",
              userError
            );

            if (
              !currentUser?.id
            ) {
              throw userError;
            }
          }

          if (
            !currentUser?.id
          ) {
            throw new Error(
              "Unable to identify the authenticated user."
            );
          }

          console.log(
            "[USER] FINAL USER:",
            currentUser
          );

          // ==================================================
          // FETCH ALL SERVER DATA
          // ==================================================

          const [
            lessonsResult,
            topicsResult,
            practiceResult,
            flashcardResult,
            assessmentResult,
            progressResult,
          ] =
            await Promise.allSettled([
              apiFetch("/lessons"),

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

          // ==================================================
          // RAW DEBUG
          // ==================================================

          console.group(
            "[ProbLearn] RAW API RESULTS"
          );

          console.log(
            "LESSONS RESULT:",
            lessonsResult
          );

          console.log(
            "TOPICS RESULT:",
            topicsResult
          );

          console.log(
            "PRACTICE RESULT:",
            practiceResult
          );

          console.log(
            "FLASHCARD RESULT:",
            flashcardResult
          );

          console.log(
            "ASSESSMENT RESULT:",
            assessmentResult
          );

          console.log(
            "PROGRESS RESULT:",
            progressResult
          );

          console.groupEnd();

          // ==================================================
          // REQUEST PROTECTION
          // ==================================================

          if (
            requestId !==
            loadRequestRef.current
          ) {
            console.warn(
              "Ignoring outdated homepage request:",
              requestId
            );

            console.groupEnd();

            return;
          }

          // ==================================================
          // LESSONS
          // ==================================================

          let finalLessons = [];

          if (
            lessonsResult.status ===
            "fulfilled"
          ) {
            finalLessons =
              extractLessons(
                lessonsResult.value
              );

            console.log(
              "[LESSONS] Count:",
              finalLessons.length
            );

            console.log(
              "[LESSONS] Data:",
              finalLessons
            );

            setLessons(
              finalLessons
            );
          } else {
            console.error(
              "[LESSONS] FAILED:",
              lessonsResult.reason
            );
          }

          // ==================================================
          // TOPICS
          // ==================================================

          let finalTopics = [];

          if (
            topicsResult.status ===
            "fulfilled"
          ) {
            finalTopics =
              getArrayData(
                topicsResult.value
              );

            console.log(
              "[TOPICS] Direct endpoint count:",
              finalTopics.length
            );

            console.log(
              "[TOPICS] Direct endpoint data:",
              finalTopics
            );

            // If /topics returned nothing,
            // use topics embedded inside lessons.

            if (
              finalTopics.length === 0 &&
              finalLessons.length > 0
            ) {
              finalTopics =
                extractTopicsFromLessons(
                  finalLessons
                );

              console.log(
                "[TOPICS] FALLBACK from lessons:",
                finalTopics.length
              );
            }

            setTopics(
              finalTopics
            );
          } else {
            console.error(
              "[TOPICS] FAILED:",
              topicsResult.reason
            );

            if (
              finalLessons.length > 0
            ) {
              finalTopics =
                extractTopicsFromLessons(
                  finalLessons
                );

              setTopics(
                finalTopics
              );

              console.log(
                "[TOPICS] FALLBACK from lessons after API failure:",
                finalTopics.length
              );
            }
          }

          // ==================================================
          // PRACTICE QUESTIONS
          // ==================================================

          let finalPractice = [];

          if (
            practiceResult.status ===
            "fulfilled"
          ) {
            const rawPractice =
              practiceResult.value;

            console.log(
              "[PRACTICE] Raw data:",
              rawPractice
            );

            finalPractice =
              getArrayData(
                rawPractice
              )
                .map(
                  normalizeQuestion
                )
                .filter(Boolean);

            console.log(
              "[PRACTICE] Parsed count:",
              finalPractice.length
            );

            console.log(
              "[PRACTICE] Parsed data:",
              finalPractice
            );

            setPracticeProblems(
              finalPractice
            );
          } else {
            console.error(
              "[PRACTICE] FAILED:",
              practiceResult.reason
            );

            setPracticeProblems([]);
          }

          // ==================================================
          // FLASHCARDS
          // ==================================================

          let finalFlashCards = [];

          if (
            flashcardResult.status ===
            "fulfilled"
          ) {
            const rawFlashcards =
              flashcardResult.value;

            console.log(
              "[FLASHCARDS] Raw data:",
              rawFlashcards
            );

            finalFlashCards =
              getArrayData(
                rawFlashcards
              )
                .map(
                  normalizeQuestion
                )
                .filter(Boolean);

            console.log(
              "[FLASHCARDS] Parsed count:",
              finalFlashCards.length
            );

            console.log(
              "[FLASHCARDS] Parsed data:",
              finalFlashCards
            );

            setFlashCards(
              finalFlashCards
            );

            setFlashIndex(
              (previous) => {
                if (
                  finalFlashCards.length ===
                  0
                ) {
                  return 0;
                }

                return Math.min(
                  previous,
                  finalFlashCards.length -
                    1
                );
              }
            );
          } else {
            console.error(
              "[FLASHCARDS] FAILED:",
              flashcardResult.reason
            );

            setFlashCards([]);
          }

          // ==================================================
          // ASSESSMENTS
          // ==================================================

          let finalAssessments = [];

          if (
            assessmentResult.status ===
            "fulfilled"
          ) {
            const rawAssessments =
              assessmentResult.value;

            console.log(
              "[ASSESSMENTS] Raw endpoint response:",
              rawAssessments
            );

            finalAssessments =
              getArrayData(
                rawAssessments
              )
                .map(
                  normalizeAssessment
                )
                .filter(Boolean);

            console.log(
              "[ASSESSMENTS] Direct endpoint count:",
              finalAssessments.length
            );

            console.log(
              "[ASSESSMENTS] Direct endpoint parsed:",
              finalAssessments
            );
          } else {
            console.error(
              "[ASSESSMENTS] Endpoint FAILED:",
              assessmentResult.reason
            );
          }

          // ==================================================
          // CRITICAL FALLBACK
          //
          // Your localStorage showed:
          //
          // lessons
          //   -> topics
          //      -> assessments
          //
          // Therefore if /assessments gives ZERO,
          // extract them directly from /lessons.
          // ==================================================

          if (
            finalAssessments.length === 0 &&
            finalLessons.length > 0
          ) {
            const nestedAssessments =
              extractAssessmentsFromLessons(
                finalLessons
              );

            console.log(
              "[ASSESSMENTS] FALLBACK from lessons:",
              nestedAssessments.length
            );

            console.log(
              "[ASSESSMENTS] FALLBACK DATA:",
              nestedAssessments
            );

            finalAssessments =
              nestedAssessments
                .map(
                  normalizeAssessment
                )
                .filter(Boolean);
          }

          console.log(
            "[ASSESSMENTS] FINAL COUNT:",
            finalAssessments.length
          );

          console.log(
            "[ASSESSMENTS] FINAL DATA:",
            finalAssessments
          );

          setAssessments(
            finalAssessments
          );

          // ==================================================
          // PROGRESS
          // ==================================================

          if (
            progressResult.status ===
            "fulfilled"
          ) {
            console.log(
              "[PROGRESS] Raw:",
              progressResult.value
            );

            const normalized =
              normalizeStats(
                getObjectData(
                  progressResult.value
                )
              );

            console.log(
              "[PROGRESS] Normalized:",
              normalized
            );

            setUserStats(
              normalized
            );
          } else {
            console.error(
              "[PROGRESS] FAILED:",
              progressResult.reason
            );
          }

          // ==================================================
          // FINAL DEBUG SUMMARY
          // ==================================================

          console.group(
            "%c[ProbLearn] FINAL HOMEPAGE COUNTS",
            "font-weight:bold;color:green"
          );

          console.table({
            userId:
              currentUser?.id,

            username:
              currentUser?.username,

            lessons:
              finalLessons.length,

            topics:
              finalTopics.length,

            practiceQuestions:
              finalPractice.length,

            flashcards:
              finalFlashCards.length,

            assessments:
              finalAssessments.length,
          });

          console.log(
            "Final lessons:",
            finalLessons
          );

          console.log(
            "Final topics:",
            finalTopics
          );

          console.log(
            "Final practice:",
            finalPractice
          );

          console.log(
            "Final flashcards:",
            finalFlashCards
          );

          console.log(
            "Final assessments:",
            finalAssessments
          );

          console.groupEnd();

          // ==================================================
          // FAILURE SUMMARY
          // ==================================================

          const failures = [];

          if (
            lessonsResult.status ===
            "rejected"
          ) {
            failures.push(
              "lessons"
            );
          }

          if (
            topicsResult.status ===
            "rejected"
          ) {
            failures.push(
              "topics"
            );
          }

          if (
            practiceResult.status ===
            "rejected"
          ) {
            failures.push(
              "practice"
            );
          }

          if (
            flashcardResult.status ===
            "rejected"
          ) {
            failures.push(
              "flashcards"
            );
          }

          if (
            assessmentResult.status ===
            "rejected"
          ) {
            failures.push(
              "assessments"
            );
          }

          if (
            progressResult.status ===
            "rejected"
          ) {
            failures.push(
              "progress"
            );
          }

          if (
            failures.length > 0
          ) {
            console.warn(
              "[ProbLearn] API failures:",
              failures
            );
          }

          setLoading(false);

          console.log(
            "[ProbLearn] Homepage loading COMPLETE."
          );

          console.groupEnd();
        } catch (err) {
          console.error(
            "[ProbLearn] Homepage loading ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load learning data."
          );

          setLoading(false);

          console.groupEnd();
        }
      },
      []
    );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    if (
      initialLoadRef.current
    ) {
      return;
    }

    initialLoadRef.current =
      true;

    console.log(
      "[ProbLearn] Initial homepage load..."
    );

    loadHomepageData();
  }, [loadHomepageData]);

  // ==========================================================
  // FLASHCARD PROGRESS STORAGE
  // ==========================================================

  useEffect(() => {
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
  ]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navigateTo =
    useCallback(
      (section) => {
        setActiveSection(
          section
        );

        setShowUserMenu(
          false
        );

        if (
          section ===
          "flashcards"
        ) {
          setFlashFlipped(
            false
          );
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
      },
      []
    );

  // ==========================================================
  // PRACTICE
  // ==========================================================

  const generatePractice =
    useCallback(() => {
      const filtered =
        practiceProblems.filter(
          (problem) =>
            problem.difficulty ===
            difficulty
        );

      console.log(
        "[PRACTICE] Generate:",
        {
          difficulty,
          total:
            practiceProblems.length,
          matching:
            filtered.length,
        }
      );

      if (
        filtered.length === 0
      ) {
        showToast(
          "No questions available for this difficulty.",
          "error"
        );

        setCurrentPractice(
          null
        );

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

      setPracticeSelected(
        null
      );

      setPracticeAnswered(
        false
      );

      setPracticeResult(
        null
      );

      setShowSolution(
        false
      );
    }, [
      practiceProblems,
      difficulty,
      showToast,
    ]);

  useEffect(() => {
    if (
      !loading &&
      practiceProblems.length >
        0
    ) {
      generatePractice();
    }
  }, [
    loading,
    practiceProblems.length,
    difficulty,
    generatePractice,
  ]);

  // ==========================================================
  // REFRESH PROGRESS
  // ==========================================================

  const refreshProgress =
    useCallback(async () => {
      try {
        const response =
          await apiFetch(
            "/progress"
          );

        const normalized =
          normalizeStats(
            getObjectData(
              response
            )
          );

        setUserStats(
          normalized
        );

        console.log(
          "[PROGRESS] Refreshed:",
          normalized
        );

        return normalized;
      } catch (err) {
        console.error(
          "Unable to refresh progress:",
          err
        );

        return null;
      }
    }, []);

  // ==========================================================
  // PRACTICE ANSWER
  // ==========================================================

  const handlePracticeAnswer =
    useCallback(
      async (
        answerIndex
      ) => {
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

          console.log(
            "[PRACTICE] Submitting:",
            {
              question_id:
                currentPractice.id,
              answer,
            }
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
            getObjectData(
              response
            );

          console.log(
            "[PRACTICE] Answer result:",
            resultData
          );

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

          await refreshProgress();
        } catch (err) {
          setPracticeAnswered(
            false
          );

          setPracticeSelected(
            null
          );

          showToast(
            err?.message ||
              "Unable to submit answer.",
            "error"
          );
        }
      },
      [
        currentPractice,
        practiceAnswered,
        showToast,
        launchConfetti,
        refreshProgress,
      ]
    );

  // ==========================================================
  // FLASHCARD DERIVED
  // ==========================================================

  const currentFlashCard =
    useMemo(
      () =>
        flashCards[
          flashIndex
        ] || null,

      [
        flashCards,
        flashIndex,
      ]
    );

  const currentFlashCardId =
    currentFlashCard?.id ??
    null;

  const currentFlashResult =
    useMemo(
      () =>
        currentFlashCardId
          ? flashResults[
              currentFlashCardId
            ] || null
          : null,

      [
        currentFlashCardId,
        flashResults,
      ]
    );

  const currentFlashAnswered =
    useMemo(
      () =>
        currentFlashCardId
          ? Boolean(
              flashAnswered[
                currentFlashCardId
              ]
            )
          : false,

      [
        currentFlashCardId,
        flashAnswered,
      ]
    );

  // ==========================================================
  // FLASHCARD ANSWER
  // ==========================================================

  const handleFlashAnswer =
    useCallback(
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
            getObjectData(
              response
            );

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

          await refreshProgress();
        } catch (err) {
          showToast(
            err?.message ||
              "Unable to submit flashcard answer.",
            "error"
          );
        }
      },
      [
        currentFlashCard,
        currentFlashAnswered,
        showToast,
        launchConfetti,
        refreshProgress,
      ]
    );

  // ==========================================================
  // FLASHCARD NAVIGATION
  // ==========================================================

  const nextFlashCard =
    useCallback(() => {
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

        return;
      }

      showToast(
        "🎉 All cards completed!",
        "success"
      );

      launchConfetti();
    }, [
      flashIndex,
      flashCards.length,
      showToast,
      launchConfetti,
    ]);

  const previousFlashCard =
    useCallback(() => {
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
    }, [flashIndex]);

  const resetFlashCards =
    useCallback(() => {
      if (
        !window.confirm(
          "Reset this flashcard session?"
        )
      ) {
        return;
      }

      setFlashIndex(0);

      setFlashFlipped(
        false
      );

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
    }, [showToast]);

  // ==========================================================
  // ASSESSMENT ANSWERS
  // ==========================================================

  const getAnswers =
    useCallback(
      (assessmentId) =>
        assessmentAnswers[
          assessmentId
        ] || {},

      [assessmentAnswers]
    );

  const handleAssessmentAnswer =
    useCallback(
      (
        assessmentId,
        questionId,
        answer
      ) => {
        setAssessmentAnswers(
          (previous) => {
            const current =
              previous[
                assessmentId
              ] || {};

            if (
              current[
                questionId
              ] !== undefined
            ) {
              return previous;
            }

            return {
              ...previous,

              [assessmentId]: {
                ...current,

                [questionId]:
                  answer,
              },
            };
          }
        );
      },
      []
    );

  // ==========================================================
  // RESET ASSESSMENT ANSWERS
  // ==========================================================

  const resetAssessmentAnswers =
    useCallback(
      (assessmentId) => {
        setAssessmentAnswers(
          (previous) => {
            if (
              !previous[
                assessmentId
              ]
            ) {
              return previous;
            }

            const updated = {
              ...previous,
            };

            delete updated[
              assessmentId
            ];

            return updated;
          }
        );
      },
      []
    );

  // ==========================================================
  // START ASSESSMENT
  // ==========================================================

  const startAssessment =
    useCallback(
      async (
        assessmentId
      ) => {
        const numericId =
          Number(
            assessmentId
          );

        try {
          console.log(
            "[ASSESSMENT] Starting:",
            numericId
          );

          const existing =
            assessments.find(
              (item) =>
                Number(
                  item.id
                ) === numericId
            );

          console.log(
            "[ASSESSMENT] Existing assessment:",
            existing
          );

          if (
            existing?.locked ||
            existing?.status ===
              "passed"
          ) {
            showToast(
              "🔒 You already passed this assessment. It is locked.",
              "info"
            );

            return;
          }

          if (
            existing?.status ===
            "failed"
          ) {
            resetAssessmentAnswers(
              numericId
            );
          }

          const response =
            await apiFetch(
              `/assessments/${numericId}`
            );

          console.log(
            "[ASSESSMENT] Detail response:",
            response
          );

          const assessment =
            getObjectData(
              response
            );

          const normalized =
            normalizeAssessment(
              assessment
            );

          console.log(
            "[ASSESSMENT] Normalized detail:",
            normalized
          );

          if (
            normalized?.locked ||
            normalized?.status ===
              "passed"
          ) {
            setAssessments(
              (previous) =>
                previous.map(
                  (item) =>
                    Number(
                      item.id
                    ) === numericId
                      ? {
                          ...item,
                          ...normalized,

                          locked: true,
                          passed: true,
                          status:
                            "passed",

                          can_retake:
                            false,
                        }
                      : item
                )
            );

            showToast(
              "🔒 You already passed this assessment. It is locked.",
              "info"
            );

            return;
          }

          setAssessments(
            (previous) =>
              previous.map(
                (item) =>
                  Number(
                    item.id
                  ) === numericId
                    ? {
                        ...item,
                        ...normalized,

                        questions:
                          normalized?.questions ??
                          item.questions ??
                          [],
                      }
                    : item
              )
          );

          setSelectedAssessment(
            numericId
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
            err?.message ||
              "Unable to load assessment.",
            "error"
          );
        }
      },
      [
        assessments,
        resetAssessmentAnswers,
        showToast,
      ]
    );

  // ==========================================================
  // CLOSE ASSESSMENT
  // ==========================================================

  const closeAssessment =
    useCallback(() => {
      setSelectedAssessment(
        null
      );
    }, []);

  // ==========================================================
  // SUBMIT ASSESSMENT
  // ==========================================================

  const submitAssessment =
    useCallback(async () => {
      if (
        !selectedAssessment ||
        assessmentSubmitting
      ) {
        return;
      }

      const assessmentId =
        Number(
          selectedAssessment
        );

      try {
        setAssessmentSubmitting(
          true
        );

        const assessment =
          assessments.find(
            (item) =>
              Number(
                item.id
              ) === assessmentId
          );

        if (!assessment) {
          throw new Error(
            "Assessment not found."
          );
        }

        const questions =
          Array.isArray(
            assessment.questions
          )
            ? assessment.questions
            : [];

        console.log(
          "[ASSESSMENT] Submit:",
          {
            assessmentId,
            questionCount:
              questions.length,
            assessment,
          }
        );

        if (
          questions.length === 0
        ) {
          throw new Error(
            "This assessment has no questions."
          );
        }

        const currentAnswers =
          assessmentAnswers[
            assessmentId
          ] || {};

        const formattedAnswers =
          questions.map(
            (question) => {
              const questionId =
                Number(
                  question.id ??
                    question.question_id
                );

              const rawAnswer =
                currentAnswers[
                  questionId
                ];

              return {
                question_id:
                  questionId,

                answer:
                  rawAnswer !==
                    null &&
                  rawAnswer !==
                    undefined
                    ? String(
                        rawAnswer
                      )
                        .trim()
                        .toUpperCase()
                    : null,
              };
            }
          );

        const unanswered =
          formattedAnswers.filter(
            ({
              answer,
            }) => !answer
          );

        if (
          unanswered.length > 0
        ) {
          throw new Error(
            `Please answer all questions before submitting the assessment. ${unanswered.length} question(s) unanswered.`
          );
        }

        console.log(
          "[ASSESSMENT] Formatted answers:",
          formattedAnswers
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

        console.log(
          "[ASSESSMENT] Submission response:",
          response
        );

        if (
          !response?.success
        ) {
          throw new Error(
            response?.message ||
              "Assessment submission failed."
          );
        }

        const submission =
          response?.data || {};

        const score =
          Number(
            submission.score ?? 0
          );

        const passed =
          submission.passed ===
            true ||
          submission.status ===
            "passed" ||
          submission.locked ===
            true ||
          score >=
            PASSING_SCORE;

        const status =
          submission.status ??
          (passed
            ? "passed"
            : "failed");

        const total =
          Number(
            submission.total ??
              assessment.total_questions ??
              assessment.total ??
              questions.length
          ) ||
          questions.length;

        const correct =
          Number(
            submission.correct ??
              0
          );

        // ======================================================
        // UPDATE UI
        // ======================================================

        setAssessments(
          (previous) =>
            previous.map(
              (item) => {
                if (
                  Number(
                    item.id
                  ) !==
                  assessmentId
                ) {
                  return item;
                }

                return {
                  ...item,

                  attempted:
                    true,

                  correct,
                  total,
                  score,
                  status,

                  passed,

                  locked:
                    passed,

                  can_retake:
                    !passed,

                  latest_attempt: {
                    ...(item.latest_attempt ||
                      {}),

                    id:
                      submission.attempt_id ??
                      item
                        .latest_attempt
                        ?.id ??
                      null,

                    attempt_number:
                      submission.attempt_number ??
                      item
                        .latest_attempt
                        ?.attempt_number ??
                      1,

                    correct,
                    total,
                    score,
                    status,
                    passed,

                    locked:
                      passed,

                    can_retake:
                      !passed,
                  },
                };
              }
            )
        );

        // ======================================================
        // CLEAR ANSWERS
        // ======================================================

        setAssessmentAnswers(
          (previous) => {
            if (
              !previous[
                assessmentId
              ]
            ) {
              return previous;
            }

            const updated = {
              ...previous,
            };

            delete updated[
              assessmentId
            ];

            return updated;
          }
        );

        closeAssessment();

        // ======================================================
        // REFRESH SERVER DATA
        // ======================================================

        await loadHomepageData(
          true
        );

        // ======================================================
        // RESULT
        // ======================================================

        if (passed) {
          launchConfetti();

          showToast(
            `🎉 Assessment passed! Score: ${score}%`,
            "success"
          );
        } else {
          showToast(
            `Assessment failed. Score: ${score}% · You can try again.`,
            "info"
          );
        }
      } catch (err) {
        console.error(
          "Assessment submission error:",
          err
        );

        showToast(
          err?.message ||
            "Failed to submit assessment.",
          "error"
        );
      } finally {
        setAssessmentSubmitting(
          false
        );
      }
    }, [
      selectedAssessment,
      assessmentSubmitting,
      assessments,
      assessmentAnswers,
      closeAssessment,
      loadHomepageData,
      launchConfetti,
      showToast,
    ]);

  // ==========================================================
  // PROFILE
  // ==========================================================

  const refreshProfile =
    useCallback(async () => {
      try {
        setUserLoading(
          true
        );

        const [
          userResponse,
          progressResponse,
        ] =
          await Promise.all([
            apiFetch("/user"),
            apiFetch("/progress"),
          ]);

        const refreshedUser =
          normalizeUser(
            userResponse
          );

        if (
          refreshedUser
        ) {
          setUser(
            (previous) => ({
              ...previous,
              ...refreshedUser,
            })
          );

          localStorage.setItem(
            "problearn_cached_user",
            JSON.stringify(
              refreshedUser
            )
          );
        }

        const normalized =
          normalizeStats(
            getObjectData(
              progressResponse
            )
          );

        setUserStats(
          normalized
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
          err?.message ||
            "Unable to refresh profile.",
          "error"
        );
      } finally {
        setUserLoading(
          false
        );
      }
    }, [showToast]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    useCallback(async () => {
      const userId =
        user?.id;

      try {
        if (
          getAuthToken()
        ) {
          try {
            await apiFetch(
              "/logout",
              {
                method:
                  "POST",
              }
            );
          } catch {
            // Local logout still happens.
          }
        }
      } finally {
        // Clear every old homepage cache.
        clearOldHomepageCaches();

        localStorage.removeItem(
          "problearn_cached_user"
        );

        localStorage.removeItem(
          "user"
        );

        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          "auth_token"
        );

        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          FLASHCARD_STORAGE_KEY
        );

        setUser(null);

        window.location.href =
          "/";
      }
    }, [user?.id]);

  // ==========================================================
  // PROFILE VALUES
  // ==========================================================

  const {
    displayName,
    username,
    userInitial,
  } = useMemo(() => {
    const name =
      user?.alias?.trim() ||
      user?.username?.trim() ||
      "Learner";

    const userName =
      user?.username?.trim() ||
      "user";

    return {
      displayName: name,

      username: userName,

      userInitial:
        name
          ?.charAt(0)
          ?.toUpperCase() ||
        "U",
    };
  }, [user]);

  // ==========================================================
  // STATS
  // ==========================================================

  const stats = useMemo(
    () => ({
      lessons:
        lessons.length,

      problems:
        practiceProblems.length,

      flashcards:
        flashCards.length,

      assessments:
        assessments.length,
    }),
    [
      lessons.length,
      practiceProblems.length,
      flashCards.length,
      assessments.length,
    ]
  );

  // ==========================================================
  // LEVEL
  // ==========================================================

  const levelNumber =
    useMemo(() => {
      return (
        Number(
          String(
            userStats.level ||
              "Level 1"
          ).replace(
            /\D/g,
            ""
          )
        ) || 1
      );
    }, [userStats.level]);

  // ==========================================================
  // LEVEL PROGRESS
  // ==========================================================

  const levelProgress =
    useMemo(() => {
      return Math.min(
        100,
        Math.max(
          0,
          (Number(
            userStats.score
          ) || 0) * 10
        )
      );
    }, [userStats.score]);

  // ==========================================================
  // DEBUG STATE CHANGES
  // ==========================================================

  useEffect(() => {
    console.group(
      "[ProbLearn] React state counts"
    );

    console.table({
      lessons:
        lessons.length,

      topics:
        topics.length,

      practice:
        practiceProblems.length,

      flashcards:
        flashCards.length,

      assessments:
        assessments.length,

      loading,

      userId:
        user?.id,

      username:
        user?.username,
    });

    console.groupEnd();
  }, [
    lessons.length,
    topics.length,
    practiceProblems.length,
    flashCards.length,
    assessments.length,
    loading,
    user?.id,
    user?.username,
  ]);

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
                onClick={() =>
                  loadHomepageData(
                    true
                  )
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
            lessons={
              lessons
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