/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';

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
    it('должен вернуть access_token при успешной аутентификации', async () => {
      const loginDto = { login: 'admin', password: 'password' };
      const mockUser = { login: 'admin' };
      const mockToken = { access_token: 'jwt-token' };

      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockReturnValue(mockToken);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockToken);
      expect(authService.validateUser).toHaveBeenCalledWith(
        'admin',
        'password',
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });

    it('должен бросить HttpException при неверных учётных данных', async () => {
      const loginDto = { login: 'admin', password: 'wrong' };

      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(controller.login(loginDto)).rejects.toThrow(HttpException);

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Неверный логин или пароль',
      );
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
