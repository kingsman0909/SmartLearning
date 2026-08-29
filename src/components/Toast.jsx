import React from "react";
import '../styles/homepage.css'
const Toast = ({ toast }) => {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`toast ${toast.type}`}
    >
      {toast.message}
    </div>
  );
};

export default Toast;