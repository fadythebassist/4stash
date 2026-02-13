import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import "./Auth.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    signInWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    signInWithTwitter,
  } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log("🚀 Google login button clicked");
    setError("");
    setLoading(true);

    try {
      console.log("📱 Calling signInWithGoogle...");
      await signInWithGoogle();
      console.log("✅ signInWithGoogle completed, navigating to dashboard");
      navigate("/dashboard");
    } catch (err) {
      console.error("❌ Google login error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Google",
      );
    } finally {
      setLoading(false);
      console.log("🏁 Google login flow complete");
    }
  };

  const handleFacebookLogin = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithFacebook();
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Facebook",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterLogin = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithTwitter();
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Twitter",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Brand panel — visible on tablet+ */}
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">4Later</div>
          <p className="auth-brand-tagline">Save it. Find it. Later.</p>
        </div>
        <div className="auth-brand-decor auth-brand-decor-1" />
        <div className="auth-brand-decor auth-brand-decor-2" />
        <div className="auth-brand-decor auth-brand-decor-3" />
      </div>

      {/* Form panel */}
      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo">4Later</h1>
            <p className="auth-subtitle">Save content for later</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleEmailLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="social-grid">
            <button
              onClick={handleGoogleLogin}
              className="btn-social"
              disabled={loading}
              title="Google"
            >
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                  fill="#EA4335"
                />
              </svg>
            </button>

            <button
              onClick={handleFacebookLogin}
              className="btn-social"
              disabled={loading}
              title="Facebook"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877f2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </button>

            <button
              onClick={handleTwitterLogin}
              className="btn-social"
              disabled={loading}
              title="X"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>
          </div>

          <p className="auth-footer">
            Don't have an account?{" "}
            <a
              href="/register"
              onClick={(e) => {
                e.preventDefault();
                navigate("/register");
              }}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
