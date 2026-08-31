import React, { useState } from "react";
import "../styles/homepage.css";

const LearnSection = ({
  lessons = [],
  showToast,
}) => {
  const [selectedLesson, setSelectedLesson] =
    useState(null);

  const getLessonTitle = (lesson, index) => {
    return (
      lesson?.title ??
      lesson?.name ??
      `Lesson ${index + 1}`
    );
  };

  const getLessonTopics = (lesson) => {
    // Supports:
    // lesson.topics
    // lesson.topic
    // lesson.lesson_topics

    if (Array.isArray(lesson?.topics)) {
      return lesson.topics;
    }

    if (Array.isArray(lesson?.lesson_topics)) {
      return lesson.lesson_topics;
    }

    if (Array.isArray(lesson?.topic)) {
      return lesson.topic;
    }

    return [];
  };

  const openLesson = (lesson, index) => {
    setSelectedLesson({
      ...lesson,
      displayTitle: getLessonTitle(
        lesson,
        index
      ),
      topics: getLessonTopics(lesson),
    });
  };

  const closeLesson = () => {
    setSelectedLesson(null);
  };

  return (
    <section className="section active">

      <h2 className="section-title">
        📚 Learning Lessons
      </h2>

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
              Your professor hasn't assigned
              any lessons to you yet.
            </p>
          </div>
        ) : (
          lessons.map((lesson, index) => {

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
              <div
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
                    Lesson {index + 1}
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
                      {lessonTopics.length}{" "}
                      {lessonTopics.length === 1
                        ? "topic"
                        : "topics"}
                    </span>

                    <span className="lesson-view">
                      View →
                    </span>

                  </div>

                </div>

              </div>
            );
          })
        )}

      </div>

      {/* ==================================================
          LESSON MODAL
      ================================================== */}

      {selectedLesson && (
        <div
          className="lesson-modal-overlay"
          onClick={closeLesson}
        >

          <div
            className="lesson-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="lesson-modal-header">

              <div>
                <span className="lesson-modal-label">
                  📚 Learning Lesson
                </span>

                <h2>
                  {selectedLesson.displayTitle}
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
                className="lesson-modal-close"
                onClick={closeLesson}
                aria-label="Close lesson"
              >
                ✕
              </button>

            </div>

            {/* TOPICS */}

            <div className="lesson-modal-body">

              <div className="lesson-topics-header">

                <h3>
                  📌 Topics
                </h3>

                <span>
                  {
                    selectedLesson.topics
                      .length
                  }{" "}
                  {selectedLesson.topics
                    .length === 1
                    ? "topic"
                    : "topics"}
                </span>

              </div>

              {selectedLesson.topics
                .length === 0 ? (

                <div className="lesson-no-topics">

                  <div>
                    📝
                  </div>

                  <h3>
                    No topics available
                  </h3>

                  <p>
                    There are currently no
                    topics added to this
                    lesson.
                  </p>

                </div>

              ) : (

                <div className="lesson-topics-list">

                  {selectedLesson.topics.map(
                    (topic, topicIndex) => {

                      const topicTitle =
                        topic?.title ??
                        topic?.name ??
                        `Topic ${
                          topicIndex + 1
                        }`;

                      const topicDescription =
                        topic?.description ??
                        topic?.desc ??
                        "";

                      return (
                        <div
                          className="lesson-topic-item"
                          key={
                            topic?.id ??
                            `topic-${topicIndex}`
                          }
                        >

                          <div className="topic-number">
                            {topicIndex + 1}
                          </div>

                          <div className="topic-content">

                            <h4>
                              {topicTitle}
                            </h4>

                            {topicDescription && (
                              <p>
                                {
                                  topicDescription
                                }
                              </p>
                            )}

                            {topic?.difficulty && (
                              <span
                                className={`difficulty-tag ${topic.difficulty}`}
                              >
                                {
                                  topic.difficulty
                                }
                              </span>
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              )}

            </div>

            {/* FOOTER */}

            <div className="lesson-modal-footer">

              <button
                className="lesson-modal-done"
                onClick={closeLesson}
              >
                Close Lesson
              </button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
};

export default LearnSection;
