/**
 * Type guard to check if a value is an API error response
 */
export function isApiError(error: unknown): error is { response?: { status?: number; data?: { message?: string | string[] } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null
  );
}

/**
 * Extract error message from API error response
 */
export function getApiErrorMessage(error: unknown, defaultMessage: string = 'Произошла ошибка'): string {
  if (isApiError(error)) {
    const data = error.response?.data;
    const message = data?.message;
    
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    
    if (typeof message === 'string') {
      return message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return defaultMessage;
}

/**
 * Get HTTP status code from error response
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (isApiError(error)) {
    return error.response?.status;
  }
  return undefined;
}
