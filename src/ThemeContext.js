import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LIGHT = {
  bg: '#FFFFFF',
  card: '#F5F5F5',
  accent: '#4285F4',
  accentFg: '#FFFFFF',
  text: '#111111',
  textMuted: '#666666',
  border: '#E5E5E5',
  success: '#39B54A',
  error: '#D4145A',
  draft: '#FDBD00',
  ready: '#39B54A',
  sent: '#4285F4',
  denied: '#D4145A',
  yellow: '#FDBD00',
  red: '#D4145A',
  blue: '#4285F4',
  green: '#39B54A',
};

const DARK = {
  bg: '#000000',
  card: '#0D0D0D',
  accent: '#4285F4',
  accentFg: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#AAAAAA',
  border: '#1F1F1F',
  success: '#39B54A',
  error: '#D4145A',
  draft: '#FDBD00',
  ready: '#39B54A',
  sent: '#4285F4',
  denied: '#D4145A',
  yellow: '#FDBD00',
  red: '#D4145A',
  blue: '#4285F4',
  green: '#39B54A',
};

const ThemeContext = createContext({ colors: LIGHT, isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('dark_mode').then(val => {
      if (val === 'true') setIsDark(true);
    });
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem('dark_mode', String(next));
  }

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
