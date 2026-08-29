import React, { useMemo } from "react";
import '../styles/homepage.css'

const FlashcardsSection = ({
  flashCards,
  flashIndex,
  flashFlipped,
  setFlashFlipped,
  flashCorrect,
  flashWrong,
  flashAnswered,
  flashResults,
  currentFlashCard,
  currentFlashResult,
  currentFlashAnswered,
  handleFlashAnswer,
  nextFlashCard,
  previousFlashCard,
  resetFlashCards,
  getCorrectAnswer,
  getEarnedPoints,
  LETTERS,
}) => {

  const flashAccuracy =
    useMemo(() => {
      const total =
        flashCorrect +
        flashWrong;

      if (total === 0) {
        return 0;
      }

      return Math.round(
        (flashCorrect / total) *
          100
      );
    }, [
      flashCorrect,
      flashWrong,
    ]);

  return (
    <section className="section active">

      <h2 className="section-title">
        🃏 Flash Cards
      </h2>

      {currentFlashCard ? (
        <>

          <div className="progress-bar-container">

            <div
              className="progress-bar"
              style={{
                width: `${
                  ((flashIndex + 1) /
                    flashCards.length) *
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
            >

              {/* FRONT */}

              <div className="card-front">

                <span className="category-tag">

                  📊{" "}

                  {
                    currentFlashCard
                      .topic
                      ?.title ??
                    currentFlashCard
                      .topic
                      ?.name ??
                    currentFlashCard
                      .category ??
                    "Probability"
                  }

                </span>

                <span className="card-number">

                  {flashIndex + 1}/
                  {flashCards.length}

                </span>

                <div className="question">
                  {currentFlashCard.question}
                </div>

                <div className="flash-options">

                  {(currentFlashCard.options || []).map(
                    (option, index) => {

                      const letter =
                        LETTERS[index];

                      const selectedAnswer =
                        currentFlashResult
                          ?.selected_answer;

                      const correctAnswer =
                        getCorrectAnswer(
                          currentFlashResult,
                          currentFlashCard
                        );

                      const isCorrect =
                        currentFlashAnswered &&
                        correctAnswer ===
                          letter;

                      const isWrong =
                        currentFlashAnswered &&
                        selectedAnswer ===
                          letter &&
                        !currentFlashResult?.correct;

                      return (
                        <button
                          key={`${currentFlashCard.id}-${index}`}
                          className={`option-btn ${
                            isCorrect
                              ? "correct"
                              : ""
                          } ${
                            isWrong
                              ? "wrong"
                              : ""
                          }`}
                          disabled={
                            currentFlashAnswered
                          }
                          onClick={(event) => {
                            event.stopPropagation();

                            handleFlashAnswer(
                              index
                            );
                          }}
                        >

                          <span className="letter">
                            {letter}
                          </span>

                          {option}

                        </button>
                      );
                    }
                  )}

                </div>

                {currentFlashAnswered && (
                  <div className="feedback-text">

                    {currentFlashResult?.correct
                      ? `✅ Correct! +${getEarnedPoints(
                          currentFlashResult
                        )} points`
                      : `❌ Incorrect. Correct answer: ${getCorrectAnswer(
                          currentFlashResult,
                          currentFlashCard
                        ) || "Not provided"}`}

                  </div>
                )}

                <div className="click-hint">

                  💡 Use the Flip button
                  below to view the
                  explanation

                </div>

              </div>

              {/* BACK */}

              <div
                className="card-back"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >

                <div className="answer-label">
                  💡 Result
                </div>

                {currentFlashResult ? (
                  <>

                    <div className="answer">

                      {currentFlashResult.correct
                        ? "✅ Correct!"
                        : "❌ Incorrect"}

                    </div>

                    <div className="correct-answer-display">

                      <strong>
                        Correct Answer:
                      </strong>

                      <div>
                        {getCorrectAnswer(
                          currentFlashResult,
                          currentFlashCard
                        ) ||
                          "Not provided"}
                      </div>

                    </div>

                    <div className="points-earned">

                      🏆 +
                      {getEarnedPoints(
                        currentFlashResult
                      )}{" "}
                      points

                    </div>

                    {(currentFlashResult.explanation ||
                      currentFlashCard.explanation) && (
                      <div className="explanation">

                        {
                          currentFlashResult
                            .explanation ||
                          currentFlashCard
                            .explanation
                        }

                      </div>
                    )}

                  </>
                ) : (
                  <>

                    <div className="answer">
                      Answer the question first.
                    </div>

                    <div className="explanation">

                      Choose an option
                      on the front of
                      the card to check
                      your answer.

                    </div>

                  </>
                )}

              </div>

            </div>

          </div>

          <div className="card-counter">

            Card {flashIndex + 1}
            {" "}of{" "}
            {flashCards.length}

          </div>

          <div className="controls">

            <button
              className="btn-secondary"
              onClick={
                previousFlashCard
              }
              disabled={
                flashIndex === 0
              }
            >
              ◀ Previous
            </button>

            <button
              className="btn-primary"
              onClick={() =>
                setFlashFlipped(
                  (previous) =>
                    !previous
                )
              }
            >
              🔄{" "}
              {flashFlipped
                ? "Show Question"
                : "Flip"}
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
              className="btn-secondary"
              onClick={
                resetFlashCards
              }
            >
              🔄 Reset
            </button>

          </div>

          <div className="stats-grid">

            <div className="stat-item">
              <div className="value">
                {flashCards.length}
              </div>
              <div className="label">
                Total Cards
              </div>
            </div>

            <div className="stat-item">
              <div className="value">
                {flashCorrect}
              </div>
              <div className="label">
                ✅ Correct
              </div>
            </div>

            <div className="stat-item">
              <div className="value">
                {flashWrong}
              </div>
              <div className="label">
                ❌ Wrong
              </div>
            </div>

            <div className="stat-item">
              <div className="value">
                {flashAccuracy}%
              </div>
              <div className="label">
                🎯 Accuracy
              </div>
            </div>

          </div>

        </>
      ) : (
        <p>
          No flashcards available.
        </p>
      )}

    </section>
  );
};

export default FlashcardsSection;