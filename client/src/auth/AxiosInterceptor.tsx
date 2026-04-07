import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from './AuthContext';
import { Logger } from '../utils/logger';

export function AxiosInterceptor() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const logoutRef = useRef(logout);
  const navigateRef = useRef(navigate);
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    Logger.debug('Registering axios response interceptor', 'AxiosInterceptor');
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          Logger.warn('401 Unauthorized detected → logging out and redirecting to /login', 'AxiosInterceptor');
          // Не делаем logout если уже на странице логина
          if (pathnameRef.current !== '/login') {
            try {
              Logger.debug('Calling logout()', 'AxiosInterceptor');
              await logoutRef.current();
              Logger.debug('Navigating to /login...', 'AxiosInterceptor');
              navigateRef.current('/login');
            } catch (logoutError) {
              Logger.error(
                'logout() failed inside interceptor',
                'AxiosInterceptor',
                {
                  message:
                    logoutError instanceof Error
                      ? logoutError.message
                      : 'unknown error',
                },
              );
            }
          } else {
            Logger.debug('Already on /login, skipping auto-logout flow', 'AxiosInterceptor');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      Logger.debug('Ejecting axios response interceptor', 'AxiosInterceptor');
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  return null;
}
