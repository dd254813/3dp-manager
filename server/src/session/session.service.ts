import { Injectable, Logger } from '@nestjs/common';

/**
 * Сервис для управления сессионными cookie
 * Хранит и предоставляет cookie для HTTP-запросов к внешним API
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private cookie: string | null = null;

  /**
   * Получить текущую сессионную cookie
   */
  getCookie(): string | null {
    return this.cookie;
  }

  /**
   * Установить сессионную cookie из заголовков ответа
   * @param setCookieHeader Массив заголовков Set-Cookie
   */
  setFromHeaders(setCookieHeader: string[] | undefined): void {
    if (!setCookieHeader) {
      this.logger.warn('Set-Cookie заголовок отсутствует');
      return;
    }

    this.cookie = setCookieHeader.map((c) => c.split(';')[0]).join('; ');

    this.logger.debug('Сессионная cookie обновлена');
  }

  /**
   * Очистить сессионную cookie
   */
  clear(): void {
    this.cookie = null;
    this.logger.debug('Сессионная cookie очищена');
  }

  /**
   * Проверить наличие сессионной cookie
   */
  hasCookie(): boolean {
    return this.cookie !== null && this.cookie.length > 0;
  }
}
