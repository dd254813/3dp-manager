import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from './AuthContext';
import { Logger } from '../utils/logger';

export function AxiosInterceptor() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          Logger.warn('401 Unauthorized detected → logging out and redirecting to /login', 'AxiosInterceptor');
          // Не делаем logout если уже на странице логина
          if (location.pathname !== '/login') {
            Logger.debug('Calling logout()', 'AxiosInterceptor');
            logout();
            Logger.debug('Navigating to /login...', 'AxiosInterceptor');
            navigate('/login');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [logout, navigate, location.pathname]);

  return null;
}