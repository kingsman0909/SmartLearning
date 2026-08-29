import React from "react";
import '../styles/homepage.css'


const PracticeSection = ({
  difficulty,
  setDifficulty,
  generatePractice,
  currentPractice,
  practiceSelected,
  practiceAnswered,
  practiceResult,
  showSolution,
  setShowSolution,
  handlePracticeAnswer,
  getCorrectAnswer,
  getEarnedPoints,
  LETTERS,
}) => {
  return (
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
          onClick={generatePractice}
        >
          🔄 New Problem
        </button>

        <button
          className="btn-secondary"
          disabled={
            !practiceResult ||
            !practiceResult.explanation
          }
          onClick={() =>
            setShowSolution(true)
          }
        >
          💡 Show Explanation
        </button>

      </div>

      <div className="practice-problem">

        {currentPractice ? (
          <>

            <div className="problem-text">
              {currentPractice.question}
            </div>

            <div className="practice-options">

              {(currentPractice.options || []).map(
                (option, index) => {

                  const letter =
                    LETTERS[index];

                  const isSelected =
                    practiceSelected ===
                    index;

                  const correctAnswer =
                    getCorrectAnswer(
                      practiceResult,
                      currentPractice
                    );

                  const isCorrect =
                    practiceAnswered &&
                    correctAnswer ===
                      letter;

                  const isWrong =
                    practiceAnswered &&
                    isSelected &&
                    !practiceResult?.correct;

                  return (
                    <button
                      key={`${currentPractice.id}-${index}`}
                      className={`practice-opt ${
                        isSelected
                          ? "selected"
                          : ""
                      } ${
                        isCorrect
                          ? "correct"
                          : ""
                      } ${
                        isWrong
                          ? "wrong"
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

                      <strong>
                        {letter}.
                      </strong>{" "}

                      {option}

                    </button>
                  );
                }
              )}

            </div>

            {practiceAnswered &&
              practiceResult && (
                <div className="feedback-text">

                  {practiceResult.correct
                    ? `✅ Correct! +${getEarnedPoints(
                        practiceResult
                      )} points`
                    : `❌ Incorrect. Correct answer: ${getCorrectAnswer(
                        practiceResult,
                        currentPractice
                      ) || "Not provided"}`}

                </div>
              )}

            {showSolution &&
              practiceResult?.explanation && (
                <div className="solution-area show">

                  💡{" "}
                  {practiceResult.explanation}

                </div>
              )}

          </>
        ) : (
          <p>
            No practice questions
            available.
          </p>
        )}

      </div>

    </section>
  );
};

export default PracticeSection;