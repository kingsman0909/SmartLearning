
import React, { useState } from "react";
import "../styles/homepage.css";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    ["home", "🏠", "Home"],
    ["learn", "📚", "Learn"], //removed ["generate-lesson", "✨", "Generate Lesson"], this is for updated version later
    ["practice", "✏️", "Practice"],
    ["flashcards", "🃏", "Flash Cards"],
    ["assessments", "📝", "Assessments"],
  ];

  const handleNavigation = (section) => {
    navigateTo(section);
    setSidebarOpen(false);
  };

  return (
    <>
      {/* HEADER */}
      <header className="header">

        {/* MOBILE HAMBURGER */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* LOGO */}
        <div className="logo">
          <span>🎲</span>
          <h1>ProbLearn</h1>
        </div>

        {/* HEADER STATS */}
        <div className="header-stats">
          <span className="level-badge">
            ⭐ {userStats.level || "Level 1"}
          </span>

          <span className="score-display">
            🏆 {userStats.score ?? 0} pts
          </span>
        </div>

        {/* DESKTOP NAVIGATION */}
        <nav className="nav-buttons">
          {navigation.map(([section, icon, label]) => {
            if (section === "generate-lesson") {
              return null;
            }

            return (
              <button
                key={section}
                className={`nav-btn ${
                  activeSection === section ? "active" : ""
                }`}
                onClick={() => navigateTo(section)}
              >
                {icon} {label}
              </button>
            );
          })}
        </nav>

        {/* USER MENU */}
        <div className="user-menu-wrapper">
          <button
            className="user-profile-button"
            onClick={() =>
              setShowUserMenu((previous) => !previous)
            }
          >
            <div className="user-avatar">
              {userInitial}
            </div>

            <div className="user-mini-info">
              <strong>{displayName}</strong>
              <span>{userStats.level}</span>
            </div>

            <span>▾</span>
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="dropdown-user">
                <div className="large-avatar">
                  {userInitial}
                </div>

                <div>
                  <strong>{displayName}</strong>
                  <span>@{username}</span>
                </div>
              </div>

              <button onClick={openProfile}>
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

      {/* MOBILE SIDEBAR OVERLAY */}
      <div
        className={`mobile-sidebar-overlay ${
          sidebarOpen ? "show" : ""
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* MOBILE SLIDE-IN SIDEBAR */}
      <aside
        className={`mobile-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
        aria-hidden={!sidebarOpen}
      >
        {/* SIDEBAR HEADER */}
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-logo">
            <span>🎲</span>
            <strong>ProbLearn</strong>
          </div>

          <button
            className="mobile-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        {/* USER INFO */}
        <div className="mobile-sidebar-user">
          <div className="user-avatar">
            {userInitial}
          </div>

          <div className="mobile-sidebar-user-info">
            <strong>{displayName}</strong>
            <span>@{username}</span>
          </div>
        </div>

        {/* MOBILE STATS */}
        <div className="mobile-sidebar-stats">
          <div>
            <span>⭐</span>
            <strong>{userStats.level || "Level 1"}</strong>
          </div>

          <div>
            <span>🏆</span>
            <strong>{userStats.score ?? 0} pts</strong>
          </div>
        </div>

        <div className="mobile-sidebar-divider" />

        {/* NAVIGATION LINKS */}
        <nav className="mobile-sidebar-nav">
          <span className="mobile-sidebar-label">
            MENU
          </span>

          {navigation.map(([section, icon, label]) => (
            <button
              key={section}
              className={`mobile-sidebar-link ${
                activeSection === section ? "active" : ""
              }`}
              onClick={() => handleNavigation(section)}
              tabIndex={sidebarOpen ? 0 : -1}
            >
              <span className="sidebar-link-icon">
                {icon}
              </span>

              <span>{label}</span>

              {activeSection === section && (
                <span className="sidebar-active-indicator">
                  ●
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="mobile-sidebar-footer">
          <button
            className="mobile-sidebar-link"
            onClick={() => {
              setSidebarOpen(false);
              openProfile();
            }}
            tabIndex={sidebarOpen ? 0 : -1}
          >
            <span className="sidebar-link-icon">👤</span>
            <span>My Profile</span>
          </button>

          <button
            className="mobile-sidebar-link logout"
            onClick={() => {
              setSidebarOpen(false);
              handleLogout();
            }}
            tabIndex={sidebarOpen ? 0 : -1}
          >
            <span className="sidebar-link-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Header;