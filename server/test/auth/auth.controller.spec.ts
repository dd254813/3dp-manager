/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import type { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    changePassword: jest.fn(),
    updateAdminProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockResponse = {
      cookie: jest
        .fn<ReturnType<Response['cookie']>, Parameters<Response['cookie']>>()
        .mockReturnThis(),
      clearCookie: jest
        .fn<
          ReturnType<Response['clearCookie']>,
          Parameters<Response['clearCookie']>
        >()
        .mockReturnThis(),
    } satisfies Pick<Response, 'cookie' | 'clearCookie'>;

    it('должен вернуть access_token при успешной аутентификации', async () => {
      const loginDto = { login: 'admin', password: 'password' };
      const mockUser = { login: 'admin' };
      const mockToken = { access_token: 'jwt-token' };

      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockReturnValue(mockToken);

      const result = await controller.login(
        loginDto,
        mockResponse as unknown as Response,
      );

      expect(result).toEqual(mockToken);
      expect(authService.validateUser).toHaveBeenCalledWith(
        'admin',
        'password',
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 86400000,
          path: '/',
        }),
      );
    });

    it('должен бросить HttpException при неверных учётных данных', async () => {
      const loginDto = { login: 'admin', password: 'wrong' };

      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(
        controller.login(loginDto, mockResponse as unknown as Response),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.login(loginDto, mockResponse as unknown as Response),
      ).rejects.toThrow('Неверный логин или пароль');

      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('должен установить secure=true cookie в production режиме', async () => {
      process.env.NODE_ENV = 'production';
      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: mockAuthService,
          },
        ],
      }).compile();

      const prodController = module.get<AuthController>(AuthController);
      const loginDto = { login: 'admin', password: 'password' };
      const mockUser = { login: 'admin' };
      const mockToken = { access_token: 'jwt-token' };

      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockReturnValue(mockToken);

      await prodController.login(loginDto, mockResponse as unknown as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'jwt-token',
        expect.objectContaining({
          secure: true,
        }),
      );

      delete process.env.NODE_ENV;
    });
  });

  describe('logout', () => {
    const mockResponse = {
      cookie: jest
        .fn<ReturnType<Response['cookie']>, Parameters<Response['cookie']>>()
        .mockReturnThis(),
      clearCookie: jest
        .fn<
          ReturnType<Response['clearCookie']>,
          Parameters<Response['clearCookie']>
        >()
        .mockReturnThis(),
    } satisfies Pick<Response, 'cookie' | 'clearCookie'>;

    it('должен очистить access_token cookie и вернуть success', () => {
      const mockRequest = {
        cookies: { access_token: 'some-token' },
      } as unknown as Request;

      const result = controller.logout(
        mockRequest,
        mockResponse as unknown as Response,
      );

      expect(result).toEqual({ success: true });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('должен очистить cookie даже если cookie не было в запросе', () => {
      const mockRequest = {
        cookies: {},
      } as unknown as Request;

      const result = controller.logout(
        mockRequest,
        mockResponse as unknown as Response,
      );

      expect(result).toEqual({ success: true });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('должен установить secure=true для clearCookie в production режиме', async () => {
      process.env.NODE_ENV = 'production';
      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: mockAuthService,
          },
        ],
      }).compile();

      const prodController = module.get<AuthController>(AuthController);
      const mockRequest = {
        cookies: { access_token: 'some-token' },
      } as unknown as Request;

      prodController.logout(mockRequest, mockResponse as unknown as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          secure: true,
        }),
      );

      delete process.env.NODE_ENV;
    });
  });

  describe('changePassword', () => {
    it('должен изменить пароль', async () => {
      const newPassword = 'newSecurePassword';

      mockAuthService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(newPassword);

      expect(result).toEqual({ success: true });
      expect(authService.changePassword).toHaveBeenCalledWith(newPassword);
    });
  });

  describe('updateProfile', () => {
    it('должен обновить профиль с логином и паролем', async () => {
      const body = { login: 'newAdmin', password: 'newPassword' };

      mockAuthService.updateAdminProfile.mockResolvedValue(undefined);

      const result = await controller.updateProfile(body);

      expect(result).toEqual({ success: true });
      expect(authService.updateAdminProfile).toHaveBeenCalledWith(
        'newAdmin',
        'newPassword',
      );
    });

    it('должен обновить профиль только с логином', async () => {
      const body = { login: 'newAdmin' };

      mockAuthService.updateAdminProfile.mockResolvedValue(undefined);

      const result = await controller.updateProfile(body);

      expect(result).toEqual({ success: true });
      expect(authService.updateAdminProfile).toHaveBeenCalledWith(
        'newAdmin',
        undefined,
      );
    });
  });
});
