// @ts-nocheck
import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

const DEFAULT_LIGHT_PRIMARY = { h: 180, s: 61, l: 40 };
const DEFAULT_DARK_PRIMARY = { h: 152, s: 55, l: 45 };

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [customPrimary, setCustomPrimary] = useState(() => {
    try {
      const saved = localStorage.getItem('custom-primary');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Apply custom primary color to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const primary = customPrimary || (isDark ? DEFAULT_DARK_PRIMARY : DEFAULT_LIGHT_PRIMARY);
    const { h, s, l } = primary;

    // Primary color
    root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    const isLightPrimary = l > 55;
    root.style.setProperty('--primary-foreground', isLightPrimary ? '200 15% 10%' : '0 0% 100%');
    root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
    root.style.setProperty('--sidebar-primary', `${h} ${s}% ${l}%`);
    root.style.setProperty('--sidebar-ring', `${h} ${s}% ${l}%`);
    root.style.setProperty('--chart-1', `${h} ${s}% ${l}%`);

    // Soft background derived from primary hue
    if (isDark) {
      root.style.setProperty('--background', `${h} 15% 8%`);
      root.style.setProperty('--card', `${h} 12% 11%`);
      root.style.setProperty('--popover', `${h} 12% 11%`);
      root.style.setProperty('--muted', `${h} 12% 16%`);
      root.style.setProperty('--secondary', `${h} 12% 16%`);
      root.style.setProperty('--accent', `${h} 20% 18%`);
      root.style.setProperty('--border', `${h} 12% 18%`);
      root.style.setProperty('--input', `${h} 12% 18%`);
    } else {
      root.style.setProperty('--background', `${h} 30% 97%`);
      root.style.setProperty('--card', `${h} 20% 99%`);
      root.style.setProperty('--popover', `${h} 20% 99%`);
      root.style.setProperty('--muted', `${h} 20% 94%`);
      root.style.setProperty('--secondary', `${h} 20% 93%`);
      root.style.setProperty('--accent', `${h} 40% 92%`);
      root.style.setProperty('--border', `${h} 15% 90%`);
      root.style.setProperty('--input', `${h} 15% 88%`);
    }

    if (customPrimary) {
      localStorage.setItem('custom-primary', JSON.stringify(customPrimary));
    } else {
      localStorage.removeItem('custom-primary');
    }
  }, [customPrimary, isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const setPrimaryHSL = (h, s, l) => {
    setCustomPrimary({ h, s, l });
  };

  const resetPrimary = () => {
    setCustomPrimary(null);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, customPrimary, setPrimaryHSL, resetPrimary }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
