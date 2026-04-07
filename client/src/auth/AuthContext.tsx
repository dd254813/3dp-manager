/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import api from '../api';
import { Logger } from '../utils/logger';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const initialToken = localStorage.getItem('token');
    Logger.debug('AuthProvider initialized', 'AuthContext', {
      hasToken: Boolean(initialToken),
    });
    return initialToken;
  });

  const login = (newToken: string) => {
    Logger.debug('login() called', 'AuthContext', {
      tokenLength: newToken.length,
    });
    // Сохраняем токен в localStorage для обратной совместимости
    // Основной токен теперь в httpOnly cookie
    localStorage.setItem('token', newToken);
    setToken(newToken);
    Logger.debug('Token persisted to localStorage and auth state updated', 'AuthContext');
  };

  const logout = async () => {
    Logger.debug('logout() called', 'AuthContext');
    try {
      // Вызываем backend для очистки httpOnly cookie
      await api.post('/auth/logout');
      Logger.debug('Backend logout request succeeded', 'AuthContext');
    } catch (error) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: unknown }).response === 'object' &&
        (error as { response?: unknown }).response !== null
          ? ((error as { response?: { status?: number } }).response?.status ?? null)
          : null;
      Logger.warn(
        'Backend logout request failed, continuing local cleanup',
        'AuthContext',
        { status },
      );
    }

    localStorage.removeItem('token');
    setToken(null);
    Logger.debug('Local auth state cleared', 'AuthContext');

    // Редирект на страницу входа
    Logger.debug('Redirecting to /login after logout', 'AuthContext');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};
