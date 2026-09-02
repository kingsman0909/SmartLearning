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
import GenerateLesson from "../components/GenerateLesson";

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

const CACHE_PREFIX =
  "problearn_homepage_cache";

const CACHE_VERSION = 1;

// Content can stay cached longer.
const CONTENT_CACHE_TTL =
  15 * 60 * 1000;

// Progress changes more frequently.
const PROGRESS_CACHE_TTL =
  30 * 1000;

const PASSING_SCORE = 60;

// ============================================================
// AUTH
// ============================================================

const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("access_token");

// ============================================================
// API
// ============================================================

const apiFetch = async (
  endpoint,
  options = {}
) => {
  const token = getAuthToken();

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

const getArrayData = (
  response
) => {
  const data =
    response?.data ??
    response;

  return Array.isArray(data)
    ? data
    : [];
};

const getObjectData = (
  response
) =>
  response?.data ??
  response ??
  {};

// ============================================================
// CACHE HELPERS
// ============================================================

const getCacheKey = (
  userId
) =>
  `${CACHE_PREFIX}:v${CACHE_VERSION}:${userId}`;

const readCache = (
  userId
) => {
  if (!userId) {
    return null;
  }

  try {
    const key =
      getCacheKey(userId);

    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn(
      "Unable to read homepage cache:",
      error
    );

    return null;
  }
};

const writeCache = (
  userId,
  data
) => {
  if (!userId) {
    return;
  }

  try {
    const key =
      getCacheKey(userId);

    localStorage.setItem(
      key,
      JSON.stringify({
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    // localStorage can fail if the cache
    // becomes too large.
    console.warn(
      "Unable to save homepage cache:",
      error
    );
  }
};

const clearUserCache = (
  userId
) => {
  if (!userId) {
    return;
  }

  try {
    localStorage.removeItem(
      getCacheKey(userId)
    );
  } catch {
    // Ignore cache cleanup errors.
  }
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

  const found = candidates.find(
    (item) =>
      item &&
      typeof item === "object" &&
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

  const options =
    Array.isArray(
      question.options
    )
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

const getEarnedPoints = (
  data
) =>
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

const normalizeStats = (
  data
) => {
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

  if (
    typeof level ===
    "number"
  ) {
    level =
      `Level ${level}`;
  } else if (
    typeof level ===
      "string" &&
    !level
      .toLowerCase()
      .startsWith("level")
  ) {
    const numericLevel =
      Number(level);

    if (
      Number.isFinite(
        numericLevel
      )
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
    !Number.isFinite(correct)
  ) {
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
    total =
      questions.length;
  }

  let score = Number(
    assessment.score ??
      assessment.percentage ??
      0
  );

  if (
    !Number.isFinite(score)
  ) {
    score = 0;
  }

  let status =
    assessment.status ??
    null;

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

  const locked =
    assessment.locked ===
      true ||
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
      assessment.passed ===
        true ||
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
        ...EMPTY_FLASHCARD_PROGRESS,
      };
    }
  };

const saveFlashcardProgress =
  (progress) => {
    try {
      localStorage.setItem(
        FLASHCARD_STORAGE_KEY,
        JSON.stringify(
          progress
        )
      );
    } catch (error) {
      console.warn(
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

  const toastTimerRef =
    useRef(null);

  const loadRequestRef =
    useRef(0);

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
  // APPLY CACHED DATA
  // ==========================================================

  const applyCachedData =
    useCallback(
      (cache) => {
        if (!cache?.data) {
          return false;
        }

        const data =
          cache.data;

        // --------------------------
        // LESSONS
        // --------------------------

        if (
          Array.isArray(
            data.lessons
          )
        ) {
          setLessons(
            data.lessons
          );
        }

        // --------------------------
        // TOPICS
        // --------------------------

        if (
          Array.isArray(
            data.topics
          )
        ) {
          setTopics(
            data.topics
          );
        }

        // --------------------------
        // PRACTICE
        // --------------------------

        if (
          Array.isArray(
            data.practiceProblems
          )
        ) {
          setPracticeProblems(
            data.practiceProblems
          );
        }

        // --------------------------
        // FLASHCARDS
        // --------------------------

        if (
          Array.isArray(
            data.flashCards
          )
        ) {
          setFlashCards(
            data.flashCards
          );
        }

        // --------------------------
        // ASSESSMENTS
        // --------------------------

        if (
          Array.isArray(
            data.assessments
          )
        ) {
          setAssessments(
            data.assessments
          );
        }

        // --------------------------
        // USER
        // --------------------------

        if (data.user) {
          setUser(
            data.user
          );
        }

        // --------------------------
        // PROGRESS
        // --------------------------

        if (data.userStats) {
          setUserStats(
            data.userStats
          );
        }

        // --------------------------
        // FLASHCARD PROGRESS
        // --------------------------

        if (
          data.flashAnswered
        ) {
          setFlashAnswered(
            data.flashAnswered
          );
        }

        if (
          data.flashResults
        ) {
          setFlashResults(
            data.flashResults
          );
        }

        if (
          Number.isFinite(
            Number(
              data.flashIndex
            )
          )
        ) {
          setFlashIndex(
            Number(
              data.flashIndex
            )
          );
        }

        return true;
      },
      []
    );

  // ==========================================================
  // BUILD CACHE DATA
  // ==========================================================

  const buildCacheData =
    useCallback(() => {
      return {
        user,
        lessons,
        topics,
        practiceProblems,
        flashCards,
        assessments,
        userStats,
        flashAnswered,
        flashResults,
        flashIndex,
      };
    }, [
      user,
      lessons,
      topics,
      practiceProblems,
      flashCards,
      assessments,
      userStats,
      flashAnswered,
      flashResults,
      flashIndex,
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

        const progressData =
          getObjectData(
            response
          );

        const normalized =
          normalizeStats(
            progressData
          );

        setUserStats(
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
  // LOAD HOMEPAGE DATA
  // ==========================================================

  const loadHomepageData =
    useCallback(
      async (
        forceRefresh = false
      ) => {
        const requestId =
          ++loadRequestRef.current;

        try {
          setError(null);

          // ==================================================
          // USER FIRST
          // ==================================================

          let currentUser =
            user;

          if (!currentUser) {
            try {
              const cachedUserRaw =
                localStorage.getItem(
                  "problearn_cached_user"
                );

              if (
                cachedUserRaw
              ) {
                const cachedUser =
                  JSON.parse(
                    cachedUserRaw
                  );

                if (
                  cachedUser
                ) {
                  currentUser =
                    cachedUser;

                  setUser(
                    cachedUser
                  );
                }
              }
            } catch {
              // Ignore invalid cached user.
            }
          }

          // ==================================================
          // FETCH USER
          // ==================================================

          if (
            !currentUser ||
            forceRefresh
          ) {
            try {
              const userResponse =
                await apiFetch(
                  "/user"
                );

              const fetchedUser =
                normalizeUser(
                  userResponse
                );

              if (
                fetchedUser
              ) {
                currentUser =
                  fetchedUser;

                setUser(
                  fetchedUser
                );

                try {
                  localStorage.setItem(
                    "problearn_cached_user",
                    JSON.stringify(
                      fetchedUser
                    )
                  );
                } catch {
                  // Ignore cache errors.
                }
              }
            } catch (err) {
              if (
                !currentUser
              ) {
                throw err;
              }

              console.warn(
                "Using cached user:",
                err
              );
            }
          }

          if (
            !currentUser?.id
          ) {
            throw new Error(
              "Unable to identify the authenticated user."
            );
          }

          const userId =
            currentUser.id;

          // ==================================================
          // CACHE
          // ==================================================

          const cache =
            readCache(userId);

          const cacheAge =
            cache?.timestamp
              ? Date.now() -
                cache.timestamp
              : Infinity;

          const hasCache =
            Boolean(
              cache?.data
            );

          // ==================================================
          // SHOW CACHE IMMEDIATELY
          // ==================================================

          if (
            hasCache &&
            !forceRefresh
          ) {
            applyCachedData(
              cache
            );

            // We already have usable
            // content, so remove the
            // blocking loading screen.
            setLoading(false);
          } else if (
            !hasCache
          ) {
            setLoading(true);
          }

          // ==================================================
          // FETCH CONTENT
          // ==================================================

          const shouldRefreshContent =
            forceRefresh ||
            !hasCache ||
            cacheAge >
              CONTENT_CACHE_TTL;

          const shouldRefreshProgress =
            forceRefresh ||
            !hasCache ||
            cacheAge >
              PROGRESS_CACHE_TTL;

          // ==================================================
          // CONTENT REQUESTS
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
              shouldRefreshContent
                ? apiFetch(
                    "/lessons"
                  )
                : Promise.resolve(
                    null
                  ),

              shouldRefreshContent
                ? apiFetch(
                    "/topics"
                  )
                : Promise.resolve(
                    null
                  ),

              shouldRefreshContent
                ? apiFetch(
                    "/questions/practice"
                  )
                : Promise.resolve(
                    null
                  ),

              shouldRefreshContent
                ? apiFetch(
                    "/questions/flashcards"
                  )
                : Promise.resolve(
                    null
                  ),

              shouldRefreshContent
                ? apiFetch(
                    "/assessments"
                  )
                : Promise.resolve(
                    null
                  ),

              shouldRefreshProgress
                ? apiFetch(
                    "/progress"
                  )
                : Promise.resolve(
                    null
                  ),
            ]);

          // Ignore an old request
          // finishing after a newer one.
          if (
            requestId !==
            loadRequestRef.current
          ) {
            return;
          }

          // ==================================================
          // LESSONS
          // ==================================================

          let finalLessons =
            lessons;

          if (
            lessonsResult.status ===
              "fulfilled" &&
            lessonsResult.value
          ) {
            const data =
              lessonsResult.value
                ?.lessons ??
              lessonsResult.value
                ?.data?.lessons ??
              lessonsResult.value
                ?.data ??
              [];

            finalLessons =
              Array.isArray(data)
                ? data
                : [];

            setLessons(
              finalLessons
            );
          }

          // ==================================================
          // TOPICS
          // ==================================================

          let finalTopics =
            topics;

          if (
            topicsResult.status ===
              "fulfilled" &&
            topicsResult.value
          ) {
            const data =
              getArrayData(
                topicsResult.value
              );

            finalTopics =
              data;

            setTopics(
              finalTopics
            );
          }

          // ==================================================
          // PRACTICE
          // ==================================================

          let finalPractice =
            practiceProblems;

          if (
            practiceResult.status ===
              "fulfilled" &&
            practiceResult.value
          ) {
            finalPractice =
              getArrayData(
                practiceResult.value
              )
                .map(
                  normalizeQuestion
                )
                .filter(Boolean);

            setPracticeProblems(
              finalPractice
            );
          }

          // ==================================================
          // FLASHCARDS
          // ==================================================

          let finalFlashCards =
            flashCards;

          if (
            flashcardResult.status ===
              "fulfilled" &&
            flashcardResult.value
          ) {
            finalFlashCards =
              getArrayData(
                flashcardResult.value
              )
                .map(
                  normalizeQuestion
                )
                .filter(Boolean);

            setFlashCards(
              finalFlashCards
            );
          }

          // ==================================================
          // ASSESSMENTS
          // ==================================================

          let finalAssessments =
            assessments;

          if (
            assessmentResult.status ===
              "fulfilled" &&
            assessmentResult.value
          ) {
            finalAssessments =
              getArrayData(
                assessmentResult.value
              )
                .map(
                  normalizeAssessment
                )
                .filter(Boolean);

            setAssessments(
              finalAssessments
            );
          }

          // ==================================================
          // PROGRESS
          // ==================================================

          let finalUserStats =
            userStats;

          if (
            progressResult.status ===
              "fulfilled" &&
            progressResult.value
          ) {
            finalUserStats =
              normalizeStats(
                getObjectData(
                  progressResult.value
                )
              );

            setUserStats(
              finalUserStats
            );
          }

          // ==================================================
          // NO LESSONS
          // ==================================================

          if (
            finalLessons.length ===
            0
          ) {
            setPracticeProblems(
              []
            );

            setFlashCards([]);

            setAssessments([]);

            finalPractice = [];
            finalFlashCards = [];
            finalAssessments = [];
          }

          // ==================================================
          // SAVE CACHE
          // ==================================================

          writeCache(
            userId,
            {
              user:
                currentUser,

              lessons:
                finalLessons,

              topics:
                finalTopics,

              practiceProblems:
                finalPractice,

              flashCards:
                finalFlashCards,

              assessments:
                finalAssessments,

              userStats:
                finalUserStats,

              flashAnswered,

              flashResults,

              flashIndex,
            }
          );

          setLoading(false);
        } catch (err) {
          console.error(
            "Homepage loading error:",
            err
          );

          // Don't destroy cached UI
          // if the background refresh
          // failed.
          const hasExistingData =
            lessons.length > 0 ||
            practiceProblems.length >
              0 ||
            flashCards.length > 0 ||
            assessments.length >
              0;

          if (!hasExistingData) {
            setError(
              err?.message ||
                "Unable to load learning data."
            );
          }

          setLoading(false);
        }
      },
      [
        user,
        lessons,
        topics,
        practiceProblems,
        flashCards,
        assessments,
        userStats,
        flashAnswered,
        flashResults,
        flashIndex,
        applyCachedData,
      ]
    );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadHomepageData();
  }, []);

  // ==========================================================
  // SAVE FLASHCARD PROGRESS
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
  // UPDATE CACHE AFTER IMPORTANT STATE CHANGES
  // ==========================================================

  useEffect(() => {
    if (
      loading ||
      !user?.id
    ) {
      return;
    }

    const timeout =
      setTimeout(() => {
        writeCache(
          user.id,
          buildCacheData()
        );
      }, 300);

    return () =>
      clearTimeout(timeout);
  }, [
    loading,
    user?.id,
    buildCacheData,
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

      if (
        filtered.length ===
        0
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

  // ==========================================================
  // ASSESSMENT ANSWER
  // ==========================================================

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
  // START / RETRY ASSESSMENT
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
          const existing =
            assessments.find(
              (item) =>
                Number(
                  item.id
                ) === numericId
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

          const assessment =
            getObjectData(
              response
            );

          const normalized =
            normalizeAssessment(
              assessment
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
                          item.questions,
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

          if (
            err?.message
              ?.toLowerCase()
              .includes(
                "already passed"
              )
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
            }) =>
              !answer
          );

        if (
          unanswered.length > 0
        ) {
          throw new Error(
            `Please answer all questions before submitting the assessment. ${unanswered.length} question(s) unanswered.`
          );
        }

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

        if (
          !response?.success
        ) {
          throw new Error(
            response?.message ||
              "Assessment submission failed."
          );
        }

        const submission =
          response?.data ||
          {};

        const score =
          Number(
            submission.score ??
              0
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
        // IMMEDIATE STATE UPDATE
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

        // ======================================================
        // CLOSE
        // ======================================================

        closeAssessment();

        // ======================================================
        // UPDATE CACHE IMMEDIATELY
        // ======================================================

        setTimeout(() => {
          if (user?.id) {
            setAssessments(
              (current) => {
                writeCache(
                  user.id,
                  {
                    user,

                    lessons,

                    topics,

                    practiceProblems,

                    flashCards,

                    assessments:
                      current,

                    userStats,

                    flashAnswered,

                    flashResults,

                    flashIndex,
                  }
                );

                return current;
              }
            );
          }
        }, 0);

        // ======================================================
        // BACKGROUND REFRESH
        // ======================================================

        loadHomepageData(
          true
        ).catch(
          (refreshError) => {
            console.warn(
              "Background assessment refresh failed:",
              refreshError
            );
          }
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
      user,
      lessons,
      topics,
      practiceProblems,
      flashCards,
      userStats,
      flashAnswered,
      flashResults,
      flashIndex,
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
            apiFetch(
              "/progress"
            ),
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

          try {
            localStorage.setItem(
              "problearn_cached_user",
              JSON.stringify(
                refreshedUser
              )
            );
          } catch {
            // Ignore.
          }
        }

        const progressData =
          getObjectData(
            progressResponse
          );

        const normalized =
          normalizeStats(
            progressData
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
        // Clear user cache.
        clearUserCache(
          userId
        );

        localStorage.removeItem(
          "problearn_cached_user"
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
      displayName:
        name,

      username:
        userName,

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
            GENERATE LESSON
        ================================================== */}

        {activeSection ===
          "generate-lesson" && (
          <GenerateLesson
            showToast={
              showToast
            }

            user={user}

            onLessonGenerated={() =>
              loadHomepageData(
                true
              )
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

        user={user}

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
        result={result}

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
        toast={toast}
      />
    </div>
  );
};

export default Homepage;