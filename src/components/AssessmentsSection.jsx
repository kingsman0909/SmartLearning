import React from "react";
import AssessmentDetail from "./AssessmentDetail";
import "../styles/homepage.css";

const PASSING_SCORE = 6;

const AssessmentsSection = ({
  assessments,
  selectedAssessment,
  getAnswers,
  startAssessment,
  assessmentSubmitting,
  closeAssessment,
  handleAssessmentAnswer,
  submitAssessment,
  normalizeQuestion,
  LETTERS,
}) => {
  return (
    <section className="section active">

      {!selectedAssessment ? (
        <>
          <h2 className="section-title">
            📝 Assessments
          </h2>

          <div className="assessment-grid">

            {assessments.length === 0 ? (
              <p>
                No assessments available.
              </p>
            ) : (
              assessments.map((assessment) => {

                const answers = getAnswers(
                  assessment.id
                );

                const answered =
                  Object.keys(answers).length;

                const total =
                  assessment.questions?.length ??
                  assessment.question_count ??
                  0;

                const progress =
                  total > 0
                    ? Math.round(
                        (answered / total) * 100
                      )
                    : 0;

                const status =
                  assessment.status ?? null;

                const score =
                  Number(assessment.score ?? 0);

                const isPassed =
                  status === "passed" ||
                  assessment.locked === true;

                const isFailed =
                  status === "failed";

                const isAttempted =
                  isPassed || isFailed;

                return (
                  <div
                    key={assessment.id}
                    className={`assessment-card ${
                      isFailed
                        ? "assessment-card-failed"
                        : ""
                    } ${
                      isPassed
                        ? "assessment-card-passed"
                        : ""
                    } ${
                      isPassed
                        ? "assessment-card-locked"
                        : ""
                    }`}
                    onClick={() => {
                      /*
                       * PASSED / LOCKED
                       *
                       * Do not open the assessment.
                       *
                       * startAssessment() also performs
                       * another backend/frontend lock check.
                       */

                      if (
                        assessment.locked === true ||
                        assessment.status === "passed"
                      ) {
                        return;
                      }

                      startAssessment(
                        assessment.id
                      );
                    }}
                  >

                    {/* TITLE */}
                    <h3>
                      {assessment.icon ?? "📝"}{" "}
                      {assessment.title}

                      {isPassed && (
                        <span
                          className="assessment-lock-icon"
                          title="Assessment locked"
                        >
                          {" "}🔒
                        </span>
                      )}
                    </h3>

                    {/* DESCRIPTION */}
                    <p>
                      {assessment.description}
                    </p>

                    {/* DIFFICULTY */}
                    {assessment.difficulty && (
                      <span
                        className={`difficulty-tag ${assessment.difficulty}`}
                      >
                        {assessment.difficulty}
                      </span>
                    )}

                    {/* QUESTIONS */}
                    <div className="meta">
                      📝 {total} questions
                    </div>

                    {/* STATUS */}

                    {!isAttempted && (
                      <span className="status-tag pending">
                        ⏳ Not Attempted
                      </span>
                    )}

                    {isPassed && (
                      <span className="status-tag passed">
                        🔒 Passed: {score}%
                      </span>
                    )}

                    {isFailed && (
                      <span className="status-tag failed">
                        ❌ Failed: {score}% · 🔄 Try Again
                      </span>
                    )}

                    {/* PROGRESS */}

                    {!isAttempted &&
                      progress > 0 &&
                      progress < 100 && (
                        <div className="assessment-progress">
                          <div
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      )}

                    {/* RETRY */}

                    {isFailed && (
                      <div className="assessment-retry">
                        <span>
                          🔄 You can retake this assessment.
                        </span>
                      </div>
                    )}

                    {/* LOCKED / COMPLETED */}

                    {isPassed && (
                      <div className="assessment-completed">
                        <span>
                          🔒 Assessment completed and locked.
                        </span>
                      </div>
                    )}

                  </div>
                );
              })
            )}

          </div>
        </>
      ) : (
        <AssessmentDetail
          assessment={assessments.find(
            (item) =>
              item.id === selectedAssessment
          )}

          answers={getAnswers(
            selectedAssessment
          )}

          submitting={
            assessmentSubmitting
          }

          onBack={closeAssessment}

          onAnswer={
            handleAssessmentAnswer
          }

          onSubmit={
            submitAssessment
          }

          normalizeQuestion={
            normalizeQuestion
          }

          LETTERS={LETTERS}
        />
      )}

    </section>
  );
};

export default AssessmentsSection;
