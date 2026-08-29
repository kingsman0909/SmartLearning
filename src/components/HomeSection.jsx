import React from "react";
import {
  StatCard,
  FeatureCard,
} from "./Cards";
import '../styles/homepage.css'

const HomeSection = ({
  displayName,
  userStats,
  levelNumber,
  levelProgress,
  stats,
  navigateTo,
}) => {
  return (
    <section className="section active">

      {/* HERO */}

      <div className="hero">

        <div className="welcome-text">

          <span className="welcome-label">
            👋 Welcome back!
          </span>

          <h2>
            Hello, {displayName}!
          </h2>

          <p>
            Learn, practice,
            and assess your
            understanding of
            probability
            concepts.
          </p>

        </div>

        {/* PROGRESS */}

        <div className="progress-summary">

          <div className="progress-summary-header">

            <div>

              <strong>
                ⭐ {userStats.level}
              </strong>

              <span>
                {userStats.score} points
              </span>

            </div>

            <span>
              Level {levelNumber}
            </span>

          </div>

          <div className="level-progress">

            <div
              style={{
                width: `${levelProgress}%`,
              }}
            />

          </div>

          <small>
            Keep learning to
            reach your next
            level!
          </small>

        </div>

        {/* QUICK STATS */}

        <div className="quick-stats">

          <StatCard
            value={stats.lessons}
            label="📚 Topics"
            onClick={() =>
              navigateTo("learn")
            }
          />

          <StatCard
            value={stats.problems}
            label="💡 Practice Problems"
            onClick={() =>
              navigateTo("practice")
            }
          />

          <StatCard
            value={stats.flashcards}
            label="🃏 Flash Cards"
            onClick={() =>
              navigateTo("flashcards")
            }
          />

          <StatCard
            value={stats.assessments}
            label="📝 Assessments"
            onClick={() =>
              navigateTo("assessments")
            }
          />

        </div>

      </div>

      {/* PERFORMANCE */}

      <div className="dashboard-performance">

        <div className="performance-card">

          <div className="performance-icon">
            🎯
          </div>

          <div>
            <span>
              Success Rate
            </span>

            <strong>
              {userStats.successRate}%
            </strong>
          </div>

        </div>

        <div className="performance-card">

          <div className="performance-icon">
            ✅
          </div>

          <div>
            <span>
              Correct Answers
            </span>

            <strong>
              {userStats.correct}
            </strong>
          </div>

        </div>

        <div className="performance-card">

          <div className="performance-icon">
            ❌
          </div>

          <div>
            <span>
              Incorrect Answers
            </span>

            <strong>
              {userStats.wrong}
            </strong>
          </div>

        </div>

        <div className="performance-card">

          <div className="performance-icon">
            📝
          </div>

          <div>
            <span>
              Questions Answered
            </span>

            <strong>
              {userStats.totalAnswered}
            </strong>
          </div>

        </div>

      </div>

      {/* FEATURES */}

      <div className="feature-grid">

        <FeatureCard
          icon="📖"
          title="Learn"
          description="Explore probability concepts with interactive examples and explanations."
          onClick={() =>
            navigateTo("learn")
          }
        />

        <FeatureCard
          icon="✏️"
          title="Practice"
          description="Solve problems with instant feedback and track your performance."
          onClick={() =>
            navigateTo("practice")
          }
        />

        <FeatureCard
          icon="🃏"
          title="Flash Cards"
          description="Review important probability concepts and improve your retention."
          onClick={() =>
            navigateTo("flashcards")
          }
        />

        <FeatureCard
          icon="📊"
          title="Assessments"
          description="Take graded assessments and monitor your learning progress."
          onClick={() =>
            navigateTo("assessments")
          }
        />

      </div>

    </section>
  );
};

export default HomeSection;