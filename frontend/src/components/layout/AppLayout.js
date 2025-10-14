import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Play, Network, Settings, LogOut, User, Menu, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';

export default function AppLayout({ children, hideNav = false }) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/feed', label: 'Feed', icon: Play },
    { path: '/graph', label: 'Knowledge Graph', icon: Network },
  ];

  const isActive = (path) => location.pathname === path;
  const isGraphPage = location.pathname === '/graph';

  // Full-screen mode for feed
  if (hideNav) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black">
        {children}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#F9F8F6',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '8px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      {/* Paper texture - only in light mode */}
      {!isDark && <div className="paper-texture" />}
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/20 bg-background/95 backdrop-blur-sm transition-colors duration-500">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/feed" className="flex items-center gap-4">
            <span className="font-display text-2xl tracking-tight text-foreground">
              <em className="text-[#D4AF37]">Sense</em>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-12">
            {navItems.map(({ path, label }) => (
              <Link 
                key={path} 
                to={path}
                className={`
                  text-xs uppercase tracking-[0.2em] transition-colors duration-500
                  ${isActive(path) 
                    ? 'text-[#D4AF37]' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-all duration-500"
              data-testid="theme-toggle"
              aria-label="Toggle theme"
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

            {/* Mobile menu button */}
            <button
              className="md:hidden w-10 h-10 border border-border/30 flex items-center justify-center text-foreground hover:bg-foreground hover:text-background transition-colors duration-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={16} strokeWidth={1} /> : <Menu size={16} strokeWidth={1} />}
            </button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 border border-border/30 flex items-center justify-center font-display text-sm text-foreground hover:bg-foreground hover:text-background transition-colors duration-500">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-display text-sm text-card-foreground">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-muted focus:bg-muted">
                  <Link to="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-card-foreground">
                    <Settings size={14} strokeWidth={1} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-muted focus:bg-muted">
                  <Link to="/onboarding" className="flex items-center gap-3 px-4 py-2 text-sm text-card-foreground">
                    <User size={14} strokeWidth={1} />
                    Edit Interests
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-card-foreground cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <LogOut size={14} strokeWidth={1} />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border/20 overflow-hidden"
            >
              <nav className="p-6 space-y-4">
                {navItems.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-4 py-2 text-sm uppercase tracking-[0.15em] transition-colors duration-500
                      ${isActive(path) 
                        ? 'text-[#D4AF37]' 
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <Icon size={16} strokeWidth={1} />
                    {label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative" style={{ height: 'calc(100vh - 5rem)' }}>
        {children}
      </main>

      {/* Toast Notifications */}
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: isDark ? '#1A1A1A' : '#F9F8F6',
            color: isDark ? '#F9F8F6' : '#1A1A1A',
            border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(26, 26, 26, 0.1)'}`,
            borderRadius: '0',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
