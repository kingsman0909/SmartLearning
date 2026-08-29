import React from "react";
import '../styles/homepage.css'


const AssessmentDetail = ({
  assessment,
  answers,
  submitting,
  onBack,
  onAnswer,
  onSubmit,
  normalizeQuestion,
  LETTERS,
}) => {

  if (!assessment) {
    return null;
  }

  const total =
    assessment.questions?.length || 0;

  const answered =
    Object.keys(answers).length;

  const allAnswered =
    answered === total;

  return (
    <div className="assessment-detail">

      <button
        className="back-btn"
        onClick={onBack}
        disabled={submitting}
      >
        ← Back to Assessments
      </button>

      <div className="assessment-content">

        <div className="title-section">

          <h2>
            {assessment.icon ?? "📝"}{" "}
            {assessment.title}
          </h2>

          {assessment.difficulty && (
            <span
              className={`difficulty-tag ${assessment.difficulty}`}
            >
              {assessment.difficulty}
            </span>
          )}

          <span>
            {answered}/{total} answered
          </span>

        </div>

        <p className="assessment-description">
          {assessment.description}
        </p>

        {assessment.questions?.map(
          (question, questionIndex) => {

            const normalized =
              normalizeQuestion(
                question
              );

            const selected =
              answers[normalized.id];

            const hasAnswered =
              selected !== undefined;

            return (
              <div
                className="question-item"
                key={normalized.id}
              >

                <div className="q-number">
                  Question{" "}
                  {questionIndex + 1}{" "}
                  of {total}
                </div>

                <div className="q-text">
                  {normalized.question}
                </div>

                <div className="options">

                  {(normalized.options || []).map(
                    (
                      option,
                      optionIndex
                    ) => {

                      const optionLetter =
                        LETTERS[
                          optionIndex
                        ];

                      const isSelected =
                        selected ===
                        optionLetter;

                      return (
                        <button
                          key={`${normalized.id}-${optionIndex}`}
                          className={`option-btn ${
                            isSelected
                              ? "selected"
                              : ""
                          }`}
                          disabled={
                            hasAnswered ||
                            submitting
                          }
                          onClick={() =>
                            onAnswer(
                              assessment.id,
                              normalized.id,
                              optionLetter
                            )
                          }
                        >

                          <span className="letter">
                            {optionLetter}
                          </span>

                          {option}

                        </button>
                      );
                    }
                  )}

                </div>

                {hasAnswered && (
                  <div className="feedback show">
                    ✅ Answer recorded.
                  </div>
                )}

              </div>
            );
          }
        )}

        <div className="submit-area">

          <button
            className="btn-primary"
            disabled={
              !allAnswered ||
              submitting
            }
            onClick={() =>
              onSubmit(
                assessment.id
              )
            }
          >
            {submitting
              ? "⏳ Submitting..."
              : allAnswered
              ? "📊 Submit Assessment"
              : "Answer all questions to submit"}
          </button>

        </div>

      </div>

    </div>
  );
};

export default AssessmentDetail;