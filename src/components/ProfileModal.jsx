import React from "react";
import { ProfileRecord } from "./Cards";
import '../styles/homepage.css'
const ProfileModal = ({
  showProfile,
  setShowProfile,
  user,
  userInitial,
  displayName,
  username,
  userStats,
  levelProgress,
  flashCorrect,
  topics,
  userLoading,
  refreshProfile,
  handleLogout,
}) => {
  if (!showProfile) {
    return null;
  }

  return (
    <div
      className="profile-overlay"
      onClick={() =>
        setShowProfile(false)
      }
    >

      <div
        className="profile-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <button
          className="profile-close"
          onClick={() =>
            setShowProfile(false)
          }
        >
          ✕
        </button>

        {/* HEADER */}

        <div className="profile-header">

          <div className="profile-avatar">
            {userInitial}
          </div>

          <div>

            <h2>
              {displayName}
            </h2>

            <p>
              @{username}
            </p>

          </div>

        </div>

        {/* DETAILS */}

        <div className="profile-details">

          <div className="profile-detail-item">
            <span>
              👤 Username
            </span>

            <strong>
              {user?.username ||
                "Not available"}
            </strong>
          </div>

          <div className="profile-detail-item">
            <span>
              🏷️ Alias
            </span>

            <strong>
              {user?.alias ||
                "Not set"}
            </strong>
          </div>

          <div className="profile-detail-item">
            <span>
              ⭐ Level
            </span>

            <strong>
              {userStats.level}
            </strong>
          </div>

          <div className="profile-detail-item">
            <span>
              🏆 Total Score
            </span>

            <strong>
              {userStats.score} pts
            </strong>
          </div>

        </div>

        {/* PROGRESS */}

        <div className="profile-progress-section">

          <div className="profile-section-title">
            📊 Learning Progress
          </div>

          <div className="profile-progress-card">

            <div className="profile-progress-top">

              <strong>
                {userStats.level}
              </strong>

              <span>
                {userStats.score} XP
              </span>

            </div>

            <div className="profile-progress-bar">

              <div
                style={{
                  width: `${levelProgress}%`,
                }}
              />

            </div>

          </div>

        </div>

        {/* RECORDS */}

        <div className="profile-section-title">
          🏆 Performance Records
        </div>

        <div className="profile-record-grid">

          <ProfileRecord
            icon="📝"
            value={
              userStats.totalAnswered
            }
            label="Questions Answered"
          />

          <ProfileRecord
            icon="✅"
            value={userStats.correct}
            label="Correct"
          />

          <ProfileRecord
            icon="❌"
            value={userStats.wrong}
            label="Wrong"
          />

          <ProfileRecord
            icon="🎯"
            value={`${userStats.successRate}%`}
            label="Success Rate"
          />

          <ProfileRecord
            icon="🃏"
            value={flashCorrect}
            label="Flashcards Correct"
          />

          <ProfileRecord
            icon="📚"
            value={topics.length}
            label="Topics Available"
          />

        </div>

        {/* ACTIONS */}

        <div className="profile-actions">

          <button
            className="btn-secondary"
            onClick={refreshProfile}
            disabled={userLoading}
          >
            {userLoading
              ? "⏳ Refreshing..."
              : "🔄 Refresh Records"}
          </button>

          <button
            className="logout-profile-button"
            onClick={handleLogout}
          >
            🚪 Logout
          </button>

        </div>

      </div>

    </div>
  );
};

export default ProfileModal;