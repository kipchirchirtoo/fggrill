"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  systemTheme: 'light',
  resolvedTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function IOSThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ios-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Update systemTheme when media query changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    updateSystemTheme(mediaQuery);
    mediaQuery.addEventListener('change', updateSystemTheme);
    
    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  // Initialize theme from localStorage if available
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as ThemeMode | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
    setMounted(true);
  }, [storageKey]);

  // Update document class and localStorage when theme changes
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem(storageKey, theme);
  }, [theme, systemTheme, mounted, storageKey]);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  const value = {
    theme,
    setTheme,
    systemTheme,
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useIOSTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined) {
    throw new Error('useIOSTheme must be used within a IOSThemeProvider');
  }
  
  return context;
};

interface IOSThemeSwitchProps extends React.HTMLAttributes<HTMLButtonElement> {
  hideLabel?: boolean;
}

export function IOSThemeSwitch({
  hideLabel = false,
  className,
  ...props
}: IOSThemeSwitchProps) {
  const { theme, setTheme, resolvedTheme } = useIOSTheme();
  const [mounted, setMounted] = useState(false);
  
  // Only show theme toggle after component is mounted to avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Return skeleton with the same dimensions to avoid layout shift
    return (
      <div className={cn("h-9 w-9", className)} aria-hidden="true" />
    );
  }
  
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center justify-center rounded-full p-2 transition-colors hover:bg-ios-gray-6 dark:hover:bg-[#2C2C2E]",
        className
      )}
      {...props}
    >
      {resolvedTheme === 'dark' ? (
        <div className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            className="h-5 w-5 text-yellow-500"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          {!hideLabel && <span className="ml-2">Light Mode</span>}
        </div>
      ) : (
        <div className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            className="h-5 w-5 text-slate-700"
            strokeWidth={1.5}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          {!hideLabel && <span className="ml-2">Dark Mode</span>}
        </div>
      )}
    </button>
  );
}

// Fix for hydration issues by suppressing warnings in html tag
export function IOSThemeHydrationFix() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // Get theme from local storage
            const theme = localStorage.getItem('ios-theme') || 'system';
            
            // Determine system preference
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            
            // Apply theme to document
            document.documentElement.classList.add(theme === 'system' ? systemTheme : theme);
            
            // Add suppressHydrationWarning attribute to html element
            document.documentElement.setAttribute('suppressHydrationWarning', 'true');
          })();
        `,
      }}
    />
  );
}
