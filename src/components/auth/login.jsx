import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import '../../styles/Login.css'
const Login = (props) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = (e) => {
    e.preventDefault();

    console.log("Username:", formData.username);
    console.log("Password:", formData.password);

    // Login successful
    navigate("/homepage");
  };

  return (
    <div className="login-modal">
      <form onSubmit={handleLogin}>
        <span onClick={()=>props.setLogin(false)}>X</span>
        <h1>Login</h1>

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

        <button type="submit">
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
