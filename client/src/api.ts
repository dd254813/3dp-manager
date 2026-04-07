import axios from 'axios';
import { Logger } from './utils/logger';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Отправлять cookies
});

// Interceptor для добавления токена к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  Logger.debug(`${config.method?.toUpperCase()} ${config.url} | Token: ${token ? 'EXISTS' : 'NULL'}`, 'API');
  return config;
});

// Interceptor для ответа
api.interceptors.response.use(
  (response) => {
    Logger.debug(`${response.status} OK (${response.config.method?.toUpperCase()} ${response.config.url})`, 'API');
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    Logger.error(`ERROR ${status || 'NETWORK'}: ${message} (${error.config?.method?.toUpperCase()} ${error.config?.url})`, 'API');
    return Promise.reject(error);
  }
);

export default api;
