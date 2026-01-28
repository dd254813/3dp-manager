import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
// Импортируем нашу настройку
import { getDesignTokens } from './theme'; 

type ColorMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ColorMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Читаем из localStorage или ставим 'system'
  const [mode, setMode] = useState<ColorMode>(() => {
    return (localStorage.getItem('themeMode') as ColorMode) || 'system';
  });

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prevMode) => {
      if (prevMode === 'light') return 'dark';
      if (prevMode === 'dark') return 'system';
      return 'light';
    });
  };

  // Вычисляем реальную тему (light/dark) на основе настроек и системы
  const theme = useMemo(() => {
    let activeMode: ColorMode;

    if (mode === 'system') {
      activeMode = prefersDarkMode ? 'dark' : 'light';
    } else {
      activeMode = mode;
    }

    // ВАЖНО: Используем нашу функцию getDesignTokens
    const themeOptions = getDesignTokens(activeMode);
    
    return createTheme(themeOptions);
  }, [mode, prefersDarkMode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};