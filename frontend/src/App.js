import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { motion } from 'framer-motion';
import AuthPage from '@/pages/AuthPage';
import OnboardingPage from '@/pages/OnboardingPage';
import FeedPage from '@/pages/FeedPage';
import KnowledgeGraphPage from '@/pages/KnowledgeGraphPage';
import '@/App.css';

// Cinematic Loading Component - Luxury/Editorial Style
function CinematicLoader({ dark = false }) {
  const bgColor = dark ? 'bg-[#0a0a0a]' : 'bg-[#F9F8F6]';
  const textColor = dark ? 'text-[#F9F8F6]/60' : 'text-[#1A1A1A]/60';
  const accentColor = '#D4AF37';

  return (
    <div className={`min-h-screen flex items-center justify-center ${bgColor}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {/* Animated constellation dots */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                left: `${50 + 35 * Math.cos(2 * Math.PI * i / 6)}%`,
                top: `${50 + 35 * Math.sin(2 * Math.PI * i / 6)}%`,
                backgroundColor: accentColor,
              }}
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
          {/* Center vertical line */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px"
            style={{ backgroundColor: accentColor }}
            animate={{ height: ['0px', '40px', '0px'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <motion.p
          className={`text-[10px] uppercase tracking-[0.3em] ${textColor}`}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Loading
        </motion.p>
      </motion.div>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children, dark = false }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CinematicLoader dark={dark} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

// Auth Route - redirects if already logged in
function AuthRoute({ children }) {
  const { isAuthenticated, loading, hasCompletedOnboarding } = useAuth();

  if (loading) {
    return <CinematicLoader dark={false} />;
  }

  if (isAuthenticated) {
    return <Navigate to={hasCompletedOnboarding ? '/feed' : '/onboarding'} replace />;
  }

  return children;
}

// Onboarding Check Route
function OnboardingCheckRoute({ children }) {
  const { isAuthenticated, loading, hasCompletedOnboarding } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated && !hasCompletedOnboarding) {
      // Allow access to onboarding page
    }
  }, [loading, isAuthenticated, hasCompletedOnboarding, navigate]);

  if (loading) {
    return <CinematicLoader dark={false} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth route */}
      <Route
        path="/auth"
        element={
          <AuthRoute>
            <AuthPage />
          </AuthRoute>
        }
      />

      {/* Onboarding - requires auth but not completed onboarding */}
      <Route
        path="/onboarding"
        element={
          <OnboardingCheckRoute>
            <OnboardingPage />
          </OnboardingCheckRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/feed"
        element={
          <ProtectedRoute dark={true}>
            <FeedPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/graph"
        element={
          <ProtectedRoute dark={true}>
            <KnowledgeGraphPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="App">
            <AppRoutes />
            <Toaster position="bottom-right" richColors />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
