import { useMemo } from 'react';

/**
 * Хук для определения безопасного соединения (HTTPS)
 * @returns {isSecure: boolean} - true если соединение по HTTPS
 */
export function useSecureConnection() {
  const isSecure = useMemo(() => {
    // Проверка в браузере
    if (typeof window !== 'undefined' && window.location) {
      return window.location.protocol === 'https:';
    }
    // SSR fallback - считаем небезопасным
    return false;
  }, []);

  return { isSecure };
}
