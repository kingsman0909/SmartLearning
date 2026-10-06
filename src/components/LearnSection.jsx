import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

import "../styles/homepage.css";

const LearnSection = ({
  lessons = [],
  apiFetch,
  showToast,
}) => {
  const [selectedLesson, setSelectedLesson] =
    useState(null);

  const [selectedTopic, setSelectedTopic] =
    useState(null);

  const [loadingTopic, setLoadingTopic] =
    useState(false);

  // ============================================================
  // HELPERS
  // ============================================================

  const getLessonTitle = (
    lesson,
    index
  ) => {
    return (
      lesson?.title ??
      lesson?.name ??
      `Lesson ${index + 1}`
    );
  };

  const getLessonTopics = (
    lesson
  ) => {
    if (
      Array.isArray(
        lesson?.topics
      )
    ) {
      return lesson.topics;
    }

    if (
      Array.isArray(
        lesson?.lesson_topics
      )
    ) {
      return lesson.lesson_topics;
    }

    if (
      Array.isArray(
        lesson?.topic
      )
    ) {
      return lesson.topic;
    }

    return [];
  };

  // ============================================================
  // OPEN LESSON
  // ============================================================

  const openLesson = (
    lesson,
    index
  ) => {
    setSelectedLesson({
      ...lesson,

      displayTitle:
        getLessonTitle(
          lesson,
          index
        ),

      topics:
        getLessonTopics(
          lesson
        ),
    });
  };

  // ============================================================
  // CLOSE LESSON
  // ============================================================

  const closeLesson = () => {
    setSelectedLesson(
      null
    );
  };

  // ============================================================
  // OPEN TOPIC
  // ============================================================

  const openTopic = async (
    topic,
    topicIndex
  ) => {
    if (!topic?.id) {
      console.error(
        "Topic ID is missing:",
        topic
      );

      showToast?.(
        "Unable to open topic. Topic ID is missing.",
        "error"
      );

      return;
    }

    if (
      typeof apiFetch !==
      "function"
    ) {
      console.error(
        "apiFetch was not provided to LearnSection."
      );

      showToast?.(
        "API connection is not configured.",
        "error"
      );

      return;
    }

    try {
      setLoadingTopic(
        true
      );

      const response =
        await apiFetch(
          `/topics/${topic.id}`
        );

      console.log(
        "[LEARN] Topic response:",
        response
      );

      const topicData =
        response?.data ??
        response;

      if (
        !topicData ||
        typeof topicData !==
          "object"
      ) {
        throw new Error(
          "Invalid topic response."
        );
      }

      setSelectedTopic({
        ...topicData,

        displayTitle:
          topicData?.name ??
          topicData?.title ??
          `Topic ${
            topicIndex + 1
          }`,
      });

    } catch (error) {
      console.error(
        "[LEARN] Failed to load topic:",
        error
      );

      showToast?.(
        error?.message ||
          "Failed to load topic content.",
        "error"
      );
    } finally {
      setLoadingTopic(
        false
      );
    }
  };

  // ============================================================
  // CLOSE TOPIC
  // ============================================================

  const closeTopic = () => {
    setSelectedTopic(
      null
    );
  };

  // ============================================================
  // BACK TO TOPICS
  // ============================================================

  const backToTopics = () => {
    setSelectedTopic(
      null
    );
  };

  // ============================================================
  // GET TOPIC CONTENT
  // ============================================================

  const getTopicContent = (
    topic
  ) => {
    /*
     * Expected:
     *
     * topic.content.content
     *
     * Example:
     *
     * {
     *   content: {
     *      id: 1,
     *      topic_id: 1,
     *      content: "# Probability..."
     *   }
     * }
     */

    if (
      typeof topic?.content
        ?.content === "string"
    ) {
      return topic.content.content;
    }

    /*
     * Fallback in case backend
     * directly returns content.
     */

    if (
      typeof topic?.content ===
      "string"
    ) {
      return topic.content;
    }

    return "";
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <section className="section active">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="learn-page-header">

        <div>
          <span className="learn-page-label">
            📚 Learning Center
          </span>

          <h2 className="section-title">
            Learn
          </h2>

          <p className="learn-page-description">
            Study the concepts first,
            then test what you learned
            through the practice labs.
          </p>
        </div>

      </div>


      {/* ======================================================
          LESSON LIST
      ====================================================== */}

      <div className="content-grid">

        {lessons.length === 0 ? (

          <div className="empty-learning-state">

            <div className="empty-learning-icon">
              📚
            </div>

            <h3>
              No lessons assigned yet
            </h3>

            <p>
              Your professor hasn't
              assigned any lessons to
              you yet.
            </p>

          </div>

        ) : (

          lessons.map(
            (
              lesson,
              index
            ) => {

              const title =
                getLessonTitle(
                  lesson,
                  index
                );

              const lessonTopics =
                getLessonTopics(
                  lesson
                );

              return (

                <button
                  type="button"
                  className="content-card lesson-card"
                  key={
                    lesson?.id ??
                    `lesson-${index}`
                  }
                  onClick={() =>
                    openLesson(
                      lesson,
                      index
                    )
                  }
                >

                  <div className="lesson-card-icon">
                    📖
                  </div>

                  <div className="lesson-card-content">

                    <span className="lesson-number">
                      Lesson{" "}
                      {index + 1}
                    </span>

                    <h3>
                      {title}
                    </h3>

                    <p>
                      {lesson?.description ??
                        lesson?.desc ??
                        "Explore this lesson."}
                    </p>

                    <div className="lesson-card-footer">

                      <span>
                        📌{" "}
                        {
                          lessonTopics.length
                        }{" "}
                        {lessonTopics.length ===
                        1
                          ? "topic"
                          : "topics"}
                      </span>

                      <span className="lesson-view">
                        View →
                      </span>

                    </div>

                  </div>

                </button>
              );
            }
          )

        )}

      </div>


      {/* ======================================================
          LESSON MODAL
      ====================================================== */}

      {selectedLesson && (

        <div
          className="learn-modal-overlay"
          onClick={
            closeLesson
          }
        >

          <div
            className="learn-modal lesson-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="learn-modal-header">

              <div className="learn-modal-header-info">

                <span className="learn-modal-label">
                  📚 Learning Lesson
                </span>

                <h2>
                  {
                    selectedLesson.displayTitle
                  }
                </h2>

                {selectedLesson.description && (
                  <p>
                    {
                      selectedLesson.description
                    }
                  </p>
                )}

              </div>

              <button
                type="button"
                className="learn-modal-close"
                onClick={
                  closeLesson
                }
                aria-label="Close lesson"
              >
                ×
              </button>

            </div>


            {/* BODY */}

            <div className="learn-modal-body">

              <div className="learn-topics-heading">

                <div>

                  <span>
                    LESSON CONTENT
                  </span>

                  <h3>
                    📌 Topics
                  </h3>

                </div>

                <span className="learn-topic-count">
                  {
                    selectedLesson
                      .topics
                      .length
                  }{" "}
                  {
                    selectedLesson
                      .topics
                      .length ===
                    1
                      ? "topic"
                      : "topics"
                  }
                </span>

              </div>


              {selectedLesson.topics
                .length ===
              0 ? (

                <div className="lesson-no-topics">

                  <div className="lesson-no-topics-icon">
                    📝
                  </div>

                  <h3>
                    No topics available
                  </h3>

                  <p>
                    There are currently
                    no topics added to
                    this lesson.
                  </p>

                </div>

              ) : (

                <div className="lesson-topics-list">

                  {selectedLesson.topics.map(
                    (
                      topic,
                      topicIndex
                    ) => {

                      const topicTitle =
                        topic?.title ??
                        topic?.name ??
                        `Topic ${
                          topicIndex +
                          1
                        }`;

                      const topicDescription =
                        topic?.description ??
                        topic?.desc ??
                        "";

                      return (

                        <button
                          type="button"
                          className="lesson-topic-item"
                          key={
                            topic?.id ??
                            `topic-${topicIndex}`
                          }
                          onClick={() =>
                            openTopic(
                              topic,
                              topicIndex
                            )
                          }
                        >

                          <div className="topic-number">
                            {
                              topicIndex +
                              1
                            }
                          </div>

                          <div className="topic-content">

                            <span className="topic-small-label">
                              TOPIC{" "}
                              {
                                topicIndex +
                                1
                              }
                            </span>

                            <h4>
                              {
                                topicTitle
                              }
                            </h4>

                            {topicDescription && (
                              <p>
                                {
                                  topicDescription
                                }
                              </p>
                            )}

                          </div>

                          <div className="topic-open-button">
                            →
                          </div>

                        </button>

                      );
                    }
                  )}

                </div>

              )}

            </div>


            {/* FOOTER */}

            <div className="learn-modal-footer">

              <button
                type="button"
                className="learn-modal-secondary-button"
                onClick={
                  closeLesson
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}


      {/* ======================================================
          TOPIC CONTENT MODAL
      ====================================================== */}

      {selectedTopic && (

        <div
          className="learn-modal-overlay topic-content-overlay"
          onClick={
            closeTopic
          }
        >

          <div
            className="learn-modal topic-content-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="learn-modal-header">

              <div className="learn-modal-header-info">

                <span className="learn-modal-label">
                  📖 Topic Lesson
                </span>

                <h2>
                  {
                    selectedTopic.displayTitle
                  }
                </h2>

                {selectedTopic.description && (
                  <p>
                    {
                      selectedTopic.description
                    }
                  </p>
                )}

              </div>

              <button
                type="button"
                className="learn-modal-close"
                onClick={
                  closeTopic
                }
                aria-label="Close topic"
              >
                ×
              </button>

            </div>


            {/* TOPIC BODY */}

            <div className="learn-modal-body topic-content-body">

              {loadingTopic ? (

                <div className="topic-loading">

                  <div className="topic-loading-spinner">
                  </div>

                  <h3>
                    Loading topic...
                  </h3>

                  <p>
                    Getting your learning
                    material.
                  </p>

                </div>

              ) : (

                <div className="topic-markdown-content">

                  {getTopicContent(
                    selectedTopic
                  ) ? (

                    <ReactMarkdown>
                      {
                        getTopicContent(
                          selectedTopic
                        )
                      }
                    </ReactMarkdown>

                  ) : (

                    <div className="topic-no-content">

                      <div className="topic-no-content-icon">
                        📝
                      </div>

                      <h3>
                        No content available
                      </h3>

                      <p>
                        This topic does not
                        have learning content
                        yet.
                      </p>

                    </div>

                  )}

                </div>

              )}

            </div>


            {/* FOOTER */}

            <div className="learn-modal-footer">

              <button
                type="button"
                className="learn-modal-secondary-button"
                onClick={
                  backToTopics
                }
              >
                ← Back to Topics
              </button>

              <button
                type="button"
                className="learn-modal-primary-button"
                onClick={
                  closeTopic
                }
              >
                Done
              </button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
};

export default LearnSection;

