import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from 'src/session/session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setFromHeaders', () => {
    it('должен установить cookie из заголовка (массив)', () => {
      const cookieHeader = ['session=abc123; Path=/; HttpOnly'];

      service.setFromHeaders(cookieHeader);

      const cookie = service.getCookie();
      expect(cookie).toBe('session=abc123');
    });

    it('должен установить cookie без атрибутов', () => {
      const cookieHeader = ['session=xyz789'];

      service.setFromHeaders(cookieHeader);

      const cookie = service.getCookie();
      expect(cookie).toBe('session=xyz789');
    });

    it('должен обработать несколько cookie', () => {
      const cookieHeader = ['session=abc; Path=/', 'other=xyz'];

      service.setFromHeaders(cookieHeader);

      const cookie = service.getCookie();
      expect(cookie).toContain('session=abc');
    });
  });

  describe('getCookie', () => {
    it('должен вернуть null, если cookie не установлен', () => {
      const cookie = service.getCookie();

      expect(cookie).toBeNull();
    });

    it('должен вернуть установленный cookie', () => {
      service.setFromHeaders(['session=test123']);

      const cookie = service.getCookie();
      expect(cookie).toBe('session=test123');
    });
  });

  describe('clear', () => {
    it('должен очистить cookie', () => {
      service.setFromHeaders(['session=test123']);
      service.clear();

      const cookie = service.getCookie();
      expect(cookie).toBeNull();
    });
  });
});
