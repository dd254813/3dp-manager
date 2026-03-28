type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4,
};

const getLogLevel = (): LogLevel => {
  return (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info';
};

const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
};

const formatMessage = (module: string, message: string, data?: unknown): string => {
  if (data !== undefined) {
    return `[${module}] ${message} ${JSON.stringify(data)}`;
  }
  return `[${module}] ${message}`;
};

export const Logger = {
  error: (message: string, module: string = 'App', data?: unknown) => {
    if (shouldLog('error')) {
      console.error(formatMessage(module, message), data || '');
    }
  },

  warn: (message: string, module: string = 'App', data?: unknown) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage(module, message), data || '');
    }
  },

  info: (message: string, module: string = 'App', data?: unknown) => {
    if (shouldLog('info')) {
      console.info(formatMessage(module, message), data || '');
    }
  },

  debug: (message: string, module: string = 'App', data?: unknown) => {
    if (shouldLog('debug')) {
      console.log(formatMessage(module, message), data || '');
    }
  },

  verbose: (message: string, module: string = 'App', data?: unknown) => {
    if (shouldLog('verbose')) {
      console.log(formatMessage(module, message), data || '');
    }
  },
};
