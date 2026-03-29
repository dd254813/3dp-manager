import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XuiService } from 'src/xui/xui.service';
import { Setting } from 'src/settings/entities/setting.entity';
import { SessionService } from 'src/session/session.service';
import axios from 'axios';

jest.mock('axios');

describe('XuiService', () => {
  let service: XuiService;

  const mockSettingsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionService = {
    getCookie: jest.fn(),
    setFromHeaders: jest.fn(),
  };

  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { baseURL: '' },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(async () => {
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XuiService,
        {
          provide: getRepositoryToken(Setting),
          useValue: mockSettingsRepo,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<XuiService>(XuiService);
    settingsRepo = module.get<Repository<Setting>>(getRepositoryToken(Setting));
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('должен вернуть false, если настройки не заполнены', async () => {
      mockSettingsRepo.find.mockResolvedValue([]);

      const result = await service.login();

      expect(result).toBe(false);
    });

    it('должен вернуть true при успешном логине', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3000' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockResolvedValue({
        headers: {
          'set-cookie': ['session=abc123'],
        },
      });

      const result = await service.login();

      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/login', {
        username: 'admin',
        password: 'password',
      });
    });

    it('должен вернуть false при ошибке логина', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3000' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await service.login();

      expect(result).toBe(false);
    });

    it('должен вернуть false, если нет cookie в ответе', async () => {
      mockSettingsRepo.find.mockResolvedValue([
        { key: 'xui_url', value: 'http://localhost:3000' },
        { key: 'xui_login', value: 'admin' },
        { key: 'xui_password', value: 'password' },
      ]);

      mockAxiosInstance.post.mockResolvedValue({
        headers: {},
      });

      const result = await service.login();

      expect(result).toBe(false);
    });
  });

  describe('checkConnection', () => {
    it('должен вернуть false при ошибке подключения', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Connection failed'));

      const result = await service.checkConnection(
        'http://localhost:3000',
        'admin',
        'password',
      );

      expect(result).toBe(false);
    });
  });

  describe('addInbound', () => {
    it('должен вернуть null при ошибке', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const result = await service.addInbound(
        {} as unknown as { port: number },
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteInbound', () => {
    it('должен удалить инбаунд', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await service.deleteInbound(101);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/panel/api/inbounds/del/101',
      );
    });

    it('должен обработать ошибку удаления', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Not found'));

      await service.deleteInbound(999);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('getNewX25519Cert', () => {
    it('должен получить Reality ключи', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          obj: {
            publicKey: 'pub-key',
            privateKey: 'priv-key',
          },
        },
      });

      const result = await service.getNewX25519Cert();

      expect(result).toEqual({
        publicKey: 'pub-key',
        privateKey: 'priv-key',
      });
    });

    it('должен вернуть null при ошибке', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const result = await service.getNewX25519Cert();

      expect(result).toBeNull();
    });
  });
});
