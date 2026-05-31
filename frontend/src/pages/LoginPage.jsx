import { useState } from "react";
import { useNavigate } from "react-router-dom";
import coverlyLogo from "../assets/coverly-logo-mark.png";

export default function LoginPage({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const API_HOST_URL = import.meta.env.VITE_API_HOST_URL;

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      const response = await fetch(`/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      console.log("Login success:", data);

      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);

      if (data.role === "admin") {
        navigate("/admin_dashboard");
      } else if (data.role === "teacher") {
        navigate("/dashboard");
      } else {
        throw new Error("Unknown user role");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6FAFD] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-[#D6EAF8]">
        <div className="flex justify-center mb-6">
          <img
            src={coverlyLogo}
            alt="Coverly Logo"
            className="w-44 h-auto object-contain"
          />
        </div>

        <h1 className="text-2xl font-bold text-[#001B3D] mb-2 text-center">
          Login
        </h1>

        <p className="text-gray-600 mb-6 text-center">
          Enter your credentials to continue
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#001B3D] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1F6FB2]"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#001B3D] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1F6FB2]"
              placeholder="Enter password"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-[#1F6FB2] text-white rounded-xl py-3 font-medium hover:bg-[#155A91] transition"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}