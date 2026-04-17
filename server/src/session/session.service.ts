import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private cookies = new Map<number, string>();

  getCookie(panelId: number): string | null {
    return this.cookies.get(panelId) ?? null;
  }

  setFromHeaders(panelId: number, setCookieHeader: string[] | undefined): void {
    if (!setCookieHeader) {
      this.logger.warn('Set-Cookie заголовок отсутствует');
      return;
    }

    const cookie = setCookieHeader.map((c) => c.split(';')[0]).join('; ');
    this.cookies.set(panelId, cookie);
    this.logger.debug(`Сессионная cookie обновлена для панели ${panelId}`);
  }

  clear(panelId?: number): void {
    if (typeof panelId === 'number') {
      this.cookies.delete(panelId);
      this.logger.debug(`Сессионная cookie очищена для панели ${panelId}`);
      return;
    }

    this.cookies.clear();
    this.logger.debug('Все сессионные cookies очищены');
  }

  hasCookie(panelId: number): boolean {
    const cookie = this.cookies.get(panelId);
    return cookie !== undefined && cookie.length > 0;
  }
}
