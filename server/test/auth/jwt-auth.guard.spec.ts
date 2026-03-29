/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);

    mockRequest = {
      url: '/api/test',
      method: 'GET',
      headers: {},
      query: {},
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('должен вернуть true для публичного маршрута', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('должен вызвать super.canActivate для защищенного маршрута', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const superCanActivate = jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate' as any)
        .mockImplementation(() => true);

      guard.canActivate(mockContext);

      expect(superCanActivate).toHaveBeenCalled();
    });

    it('НЕ должен добавлять токен, если authorization уже есть', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockRequest.query.token = 'test-jwt-token';
      mockRequest.headers.authorization = 'Bearer existing-token';

      const _superCanActivate = jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate' as any)
        .mockImplementation(() => true);

      guard.canActivate(mockContext);

      expect(mockRequest.headers.authorization).toBe('Bearer existing-token');
    });

    it('должен вернуть результат super.canActivate', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const _superCanActivate = jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate' as any)
        .mockImplementation(() => 'PENDING_RESULT');

      const result = guard.canActivate(mockContext);

      expect(result).toBe('PENDING_RESULT');
    });
  });

  describe('handleRequest', () => {
    it('должен вернуть пользователя при успешной аутентификации', () => {
      const user = { username: 'admin' };

      const result = guard.handleRequest(null, user, null);

      expect(result).toEqual(user);
    });

    it('должен бросить ошибку при наличии ошибки', () => {
      const _error = new Error('Invalid token');

      expect(() => guard.handleRequest(_error, null, null)).toThrow(Error);
    });

    it('должен бросить UnauthorizedException, если пользователь null и нет ошибки', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('должен бросить ошибку с сообщением из Error', () => {
      const _error = new Error('Custom error message');

      try {
        guard.handleRequest(_error, null, null);
      } catch (e) {
        expect((e as Error).message).toContain('Custom error message');
      }
    });

    it('должен бросить ошибку с сообщением из строки', () => {
      const _error = 'String error message';

      // handleRequest пробрасывает строковую ошибку как есть через throw
      expect(() => guard.handleRequest(_error as any, null, null)).toThrow(
        'String error message',
      );
    });

    it('должен бросить ошибку с JSON сообщением', () => {
      const _error = { message: 'JSON error' };

      // Для объекта берётся message поле
      expect(() => guard.handleRequest(_error as any, null, null)).toThrow(
        'JSON error',
      );
    });

    it('должен бросить ошибку с сообщением "null", если error=null и user=null', () => {
      try {
        guard.handleRequest(null, null, null);
      } catch (_e: any) {
        // UnauthorizedException имеет пустое сообщение по умолчанию
        expect(_e).toBeInstanceOf(UnauthorizedException);
      }
    });
  });
});
