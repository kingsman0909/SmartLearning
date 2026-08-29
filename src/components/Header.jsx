import React from "react";
import '../styles/homepage.css'

const Header = ({
  activeSection,
  navigateTo,
  userInitial,
  displayName,
  username,
  userStats,
  showUserMenu,
  setShowUserMenu,
  openProfile,
  handleLogout,
}) => {
  const navigation = [
    ["home", "🏠 Home"],
    ["learn", "📚 Learn"],
    ["practice", "✏️ Practice"],
    ["flashcards", "🃏 Flash Cards"],
    ["assessments", "📝 Assessments"],
  ];

  return (
    <header className="header">

      {/* LOGO */}

      <div className="logo">
        <span>🎲</span>

        <h1>
          ProbLearn
        </h1>
      </div>

      {/* HEADER STATS */}

      <div className="header-stats">

        <span className="level-badge">
          ⭐{" "}
          {userStats.level ||
            "Level 1"}
        </span>

        <span className="score-display">
          🏆{" "}
          {userStats.score ?? 0}{" "}
          pts
        </span>

      </div>

      {/* NAVIGATION */}

      <nav className="nav-buttons">

        {navigation.map(
          ([section, label]) => (
            <button
              key={section}
              className={`nav-btn ${
                activeSection === section
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigateTo(section)
              }
            >
              {label}
            </button>
          )
        )}

      </nav>

      {/* USER MENU */}

      <div className="user-menu-wrapper">

        <button
          className="user-profile-button"
          onClick={() =>
            setShowUserMenu(
              (previous) =>
                !previous
            )
          }
        >

          <div className="user-avatar">
            {userInitial}
          </div>

          <div className="user-mini-info">

            <strong>
              {displayName}
            </strong>

            <span>
              {userStats.level}
            </span>

          </div>

          <span>
            ▾
          </span>

        </button>

        {showUserMenu && (
          <div className="user-dropdown">

            <div className="dropdown-user">

              <div className="large-avatar">
                {userInitial}
              </div>

              <div>

                <strong>
                  {displayName}
                </strong>

                <span>
                  @{username}
                </span>

              </div>

            </div>

            <button
              onClick={openProfile}
            >
              👤 My Profile
            </button>

            <button
              onClick={() => {
                setShowUserMenu(false);
                navigateTo("home");
              }}
            >
              📊 My Progress
            </button>

            <div className="dropdown-divider" />

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              🚪 Logout
            </button>

          </div>
        )}

      </div>

    </header>
  );
};

export default Header;