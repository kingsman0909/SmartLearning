import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Login.css";

const Signup = (props) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    alias: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleSignup = (e) => {
    e.preventDefault();

    const {
      alias,
      username,
      password,
      confirmPassword,
    } = formData;

    if (
      !alias ||
      !username ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    console.log("Alias:", alias);
    console.log("Username:", username);
    console.log("Password:", password);

    navigate("/homepage");
  };

  return (
    <div className="login-modal">
      <form onSubmit={handleSignup}>

        <span
          className="close-btn"
          onClick={() => props.setSignup(false)}
        >
          X
        </span>

        <h1>Sign Up</h1>

        {error && (
          <p className="form-error">
            {error}
          </p>
        )}

        <input
          type="text"
          name="alias"
          placeholder="Alias"
          value={formData.alias}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Check Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />

        {formData.confirmPassword && (
          <p
            className={
              formData.password === formData.confirmPassword
                ? "password-match"
                : "password-no-match"
            }
          >
            {formData.password === formData.confirmPassword
              ? "✓ Passwords match"
              : "✕ Passwords do not match"}
          </p>
        )}

        <button type="submit">
          Sign Up
        </button>

      </form>
    </div>
  );
};

export default Signup;
