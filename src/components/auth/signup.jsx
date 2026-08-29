import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Login.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const Signup = (props) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    alias: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ============================================================
  // HANDLE CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  // ============================================================
  // SIGN UP
  // ============================================================

  const handleSignup = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    const {
      alias,
      username,
      password,
      confirmPassword,
    } = formData;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (
      !alias.trim() ||
      !username.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    // ----------------------------------------------------------
    // SUBMIT
    // ----------------------------------------------------------

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/register`,
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            alias,
            username,
            password,
            password_confirmation: confirmPassword,
          }),
        }
      );
      
      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      // --------------------------------------------------------
      // BACKEND ERROR
      // --------------------------------------------------------

      if (!response.ok) {
        if (
          data?.errors &&
          typeof data.errors === "object"
        ) {
          const firstError =
            Object.values(data.errors)
              .flat()
              .find(Boolean);

          throw new Error(
            firstError ||
              data?.message ||
              "Unable to create account."
          );
        }

        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to create account."
        );
      }

      // --------------------------------------------------------
      // GET TOKEN
      // --------------------------------------------------------

      const token =
        data?.token ??
        data?.access_token ??
        data?.data?.token ??
        data?.data?.access_token ??
        null;

      if (token) {
        localStorage.setItem(
          "token",
          token
        );
      }

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      setFormData({
        alias: "",
        username: "",
        password: "",
        confirmPassword: "",
      });

      // Close signup modal if available
      if (props?.setSignup) {
        props.setSignup(false);
      }

      // Go to homepage
      navigate("/homepage");

    } catch (err) {
      console.error(
        "Signup error:",
        err
      );

      setError(
        err.message ||
          "Unable to create account."
      );

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="login-modal">

      <form onSubmit={handleSignup}>

        {/* CLOSE */}

        <span
          className="close-btn"
          onClick={() => {
            if (!loading && props?.setSignup) {
              props.setSignup(false);
            }
          }}
        >
          X
        </span>

        {/* TITLE */}

        <h1>Sign Up</h1>

        {/* ERROR */}

        {error && (
          <p className="form-error">
            {error}
          </p>
        )}

        {/* ALIAS */}

        <input
          type="text"
          name="alias"
          placeholder="Alias"
          value={formData.alias}
          onChange={handleChange}
          disabled={loading}
          required
        />

        {/* USERNAME */}

        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          disabled={loading}
          required
        />

        {/* PASSWORD */}

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          disabled={loading}
          required
        />

        {/* CONFIRM PASSWORD */}

        <input
          type="password"
          name="confirmPassword"
          placeholder="Check Password"
          value={
            formData.confirmPassword
          }
          onChange={handleChange}
          disabled={loading}
          required
        />

        {/* PASSWORD STATUS */}

        {formData.confirmPassword && (
          <p
            className={
              formData.password ===
              formData.confirmPassword
                ? "password-match"
                : "password-no-match"
            }
          >
            {formData.password ===
            formData.confirmPassword
              ? "✓ Passwords match"
              : "✕ Passwords do not match"}
          </p>
        )}

        {/* SUBMIT */}

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating Account..."
            : "Sign Up"}
        </button>

      </form>

    </div>
  );
};

export default Signup;