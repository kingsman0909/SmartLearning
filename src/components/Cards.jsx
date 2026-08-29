import React from "react";
import '../styles/homepage.css'

// ============================================================
// STAT CARD
// ============================================================

export const StatCard = ({
  value,
  label,
  onClick,
}) => {
  return (
    <div
      className="stat-card"
      onClick={onClick}
    >
      <h3>{value}</h3>

      <p>{label}</p>
    </div>
  );
};

// ============================================================
// FEATURE CARD
// ============================================================

export const FeatureCard = ({
  icon,
  title,
  description,
  onClick,
}) => {
  return (
    <div
      className="feature-card"
      onClick={onClick}
    >
      <div className="feature-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </div>
  );
};

// ============================================================
// STAT ITEM
// ============================================================

export const StatItem = ({
  value,
  label,
}) => {
  return (
    <div className="stat-item">

      <div className="value">
        {value}
      </div>

      <div className="label">
        {label}
      </div>

    </div>
  );
};

// ============================================================
// PROFILE RECORD
// ============================================================

export const ProfileRecord = ({
  icon,
  value,
  label,
}) => {
  return (
    <div className="profile-record">

      <div className="record-icon">
        {icon}
      </div>

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

    </div>
  );
};