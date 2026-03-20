import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { VideoPlayerProvider } from "@/contexts/VideoPlayerContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ShareTarget from "@/pages/ShareTarget";
import Recovery from "@/pages/Recovery";
import Privacy from "@/pages/Privacy";
import "@/styles/globals.css";

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

// Public route wrapper (redirects to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner"></div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <VideoPlayerProvider>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share-target"
              element={
                <ProtectedRoute>
                  <ShareTarget />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recovery"
              element={
                <ProtectedRoute>
                  <Recovery />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
          </VideoPlayerProvider>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
