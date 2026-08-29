import React from "react";
import '../styles/homepage.css'

const ResultModal = ({
  result,
  closeResult,
}) => {
  if (!result) {
    return null;
  }

  return (
    <div className="result-overlay show">

      <div className="result-card">

        <div className="score-circle">
          {result.score}%
        </div>

        <h2>
          {Number(result.score) >= 70
            ? "🎉 Great Job!"
            : "💪 Keep Practicing!"}
        </h2>

        <p className="sub-text">
          You scored{" "}
          {result.correct} out of{" "}
          {result.total} questions
          correct.
        </p>

        {result.pointsEarned > 0 && (
          <p className="points-earned">
            🏆 + {result.pointsEarned} points
          </p>
        )}

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
          onClick={closeResult}
        >
          Continue Learning
        </button>

      </div>

    </div>
  );
};

export default ResultModal;