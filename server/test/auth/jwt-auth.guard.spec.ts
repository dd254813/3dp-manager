import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

type TestRequest = {
  url: string;
  method: string;
  headers: Record<string, string | undefined>;
  query: Record<string, unknown>;
  cookies?: unknown;
};

function createContext(request: TestRequest): ExecutionContext {
  return {
    switchToHttp: () =>
      ({
        getRequest: () => request,
      }) as ReturnType<ExecutionContext['switchToHttp']>,
    getHandler: () => ({}),
    getClass: () => class TestController {},
  } as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let parentCanActivateSpy: jest.SpyInstance;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);

    const parentPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (context: ExecutionContext) => boolean | Promise<boolean>;
    };

    parentCanActivateSpy = jest
      .spyOn(parentPrototype, 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    parentCanActivateSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    it('должен вернуть true для публичного маршрута', () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        query: {},
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(parentCanActivateSpy).not.toHaveBeenCalled();
    });

    it('должен вызывать super.canActivate для защищенного маршрута', async () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        query: {},
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await guard.canActivate(context);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(context);
    });

    it('должен добавлять токен из cookie в authorization header', async () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        query: {},
        cookies: { access_token: 'cookie-jwt-token' },
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await guard.canActivate(context);

      expect(request.headers.authorization).toBe('Bearer cookie-jwt-token');
    });

    it('не должен перезаписывать существующий authorization header', async () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: { authorization: 'Bearer existing-token' },
        query: { token: 'query-jwt-token' },
        cookies: { access_token: 'cookie-jwt-token' },
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await guard.canActivate(context);

      expect(request.headers.authorization).toBe('Bearer existing-token');
    });

    it('должен добавлять токен из query параметра в authorization header', async () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        query: { token: 'query-jwt-token' },
        cookies: {},
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await guard.canActivate(context);

      expect(request.headers.authorization).toBe('Bearer query-jwt-token');
    });

    it('не должен падать при невалидном формате cookies', async () => {
      const request: TestRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        query: {},
        cookies: 'invalid-cookies',
      };
      const context = createContext(request);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await guard.canActivate(context);

      expect(request.headers.authorization).toBeUndefined();
    });
  });

  describe('handleRequest', () => {
    it('должен вернуть пользователя при успешной аутентификации', () => {
      const user = { username: 'admin' };

      const result = guard.handleRequest(null, user, null);

      expect(result).toEqual(user);
    });

    it('должен пробрасывать Error как есть', () => {
      const authError = new Error('Invalid token');

      expect(() => {
        guard.handleRequest(authError, null, null);
      }).toThrow('Invalid token');
    });

    it('должен бросать UnauthorizedException, если нет user и err', () => {
      expect(() => {
        guard.handleRequest(null, null, null);
      }).toThrow(UnauthorizedException);
    });
  });
});
