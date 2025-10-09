import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, Sun, Moon } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn, signUp } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.success) {
        navigate('/onboarding');
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative transition-colors duration-500">
      {/* Paper texture overlay - only in light mode */}
      {!isDark && <div className="paper-texture" />}
      
      {/* Visible grid lines */}
      <div className="editorial-grid-lines hidden lg:flex" />
      
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-8 right-8 w-10 h-10 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-all duration-500 z-20"
        data-testid="auth-theme-toggle"
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Sun size={16} strokeWidth={1.5} />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Moon size={16} strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          {/* Decorative line */}
          <div className="decorative-line mx-auto mb-8" />
          
          {/* Overline */}
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Welcome to
          </p>
          
          {/* Logo text */}
          <h1 className="font-display text-6xl md:text-7xl tracking-tight text-foreground mb-4">
            <em className="text-[#D4AF37]">Sense</em>
          </h1>
          
          <p className="font-display text-lg italic text-muted-foreground">
            Your learning journey, visualized
          </p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="border-t border-border pt-12"
          data-testid="auth-card"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Email Input */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="input-editorial w-full text-foreground h-12"
                placeholder="Your email address"
                data-testid="auth-email-input"
              />
            </div>
            
            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="input-editorial w-full text-foreground h-12 pr-10"
                placeholder="Password"
                data-testid="auth-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-500"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-600 text-sm border-l-2 border-red-600 pl-4"
                data-testid="auth-error"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button - Luxury Style */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-luxury w-full h-14 bg-foreground text-background uppercase text-xs tracking-[0.2em] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-500 disabled:opacity-50"
              data-testid="auth-submit-button"
            >
              <span className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Please wait</>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </span>
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-muted-foreground hover:text-[#D4AF37] transition-colors duration-500"
              data-testid="auth-toggle-mode"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-display italic">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            A curated learning experience
          </p>
        </motion.div>
      </div>
    </div>
  );
}
