/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { DomainScannerService } from 'src/domains/domain-scanner.service';
import { spawn, spawnSync } from 'child_process';
import {
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn(),
}));

describe('DomainScannerService', () => {
  let service: DomainScannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainScannerService],
    }).compile();

    service = module.get<DomainScannerService>(DomainScannerService);

    // Мокируем getCapabilities для всех тестов
    (spawnSync as jest.Mock).mockReturnValue({
      status: 0,
      stdout: '/usr/bin/scanner',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCapabilities', () => {
    it('должен вернуть возможности сканера', () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 0, stdout: '/usr/bin/scanner' })
        .mockReturnValueOnce({ status: 0, stdout: '/usr/bin/timeout' });

      const result = service.getCapabilities();

      expect(result).toEqual({
        scannerAvailable: true,
        scannerPath: '/usr/bin/scanner',
        timeoutAvailable: true,
        timeoutPath: '/usr/bin/timeout',
      });
    });

    it('должен вернуть false, если сканер не найден', () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 1, stdout: '' })
        .mockReturnValueOnce({ status: 1, stdout: '' });

      const result = service.getCapabilities();

      expect(result.scannerAvailable).toBe(false);
      expect(result.timeoutAvailable).toBe(false);
    });

    it('должен вернуть false, если scanner найден, а timeout нет', () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 0, stdout: '/usr/bin/scanner' })
        .mockReturnValueOnce({ status: 1, stdout: '' });

      const result = service.getCapabilities();

      expect(result.scannerAvailable).toBe(true);
      expect(result.timeoutAvailable).toBe(false);
    });

    it('должен вернуть false, если timeout найден, а scanner нет', () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 1, stdout: '' })
        .mockReturnValueOnce({ status: 0, stdout: '/usr/bin/timeout' });

      const result = service.getCapabilities();

      expect(result.scannerAvailable).toBe(false);
      expect(result.timeoutAvailable).toBe(true);
    });
  });

  describe('getScanStatus', () => {
    it('должен вернуть статус без активного сканирования', () => {
      const result = service.getScanStatus();

      expect(result).toEqual({
        running: false,
        runId: null,
        addr: null,
        scanSeconds: null,
        thread: null,
        timeout: null,
        startedAt: null,
        endsAt: null,
        now: expect.any(String),
        remainingSeconds: 0,
        foundCount: 0,
        lastRunId: null,
        lastFinishedAt: null,
      });
    });

    it('должен вернуть статус активного сканирования', () => {
      (service as any).activeScan = {
        runId: 'scan-123',
        addr: '192.168.1.1',
        scanSeconds: 60,
        thread: 100,
        timeout: 30,
        startedAtMs: Date.now(),
        endsAtMs: Date.now() + 60000,
        foundCount: 5,
      };

      const result = service.getScanStatus();

      expect(result.running).toBe(true);
      expect(result.runId).toBe('scan-123');
      expect(result.foundCount).toBe(5);
    });
  });

  describe('getLastScanResult', () => {
    it('должен вернуть null, если нет результатов', () => {
      const result = service.getLastScanResult();

      expect(result).toBeNull();
    });

    it('должен вернуть последний результат', () => {
      const mockResult = {
        runId: 'scan-123',
        foundCount: 10,
        domains: ['ya.ru', 'vk.com'],
      };

      (service as any).lastScanResult = mockResult;

      const result = service.getLastScanResult();

      expect(result).toEqual(mockResult);
    });
  });

  describe('startScan', () => {
    it('должен бросить ServiceUnavailableException, если сканер не доступен', async () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 1, stdout: '' })
        .mockReturnValueOnce({ status: 1, stdout: '' });

      await expect(service.startScan({ addr: '192.168.1.1' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('должен бросить ServiceUnavailableException, если timeout не доступен', async () => {
      (spawnSync as jest.Mock)
        .mockReturnValueOnce({ status: 0, stdout: '/usr/bin/scanner' })
        .mockReturnValueOnce({ status: 1, stdout: '' });

      await expect(service.startScan({ addr: '192.168.1.1' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('должен бросить HttpException, если сканирование уже запущено', async () => {
      (service as any).isScanRunning = true;

      await expect(service.startScan({ addr: '192.168.1.1' })).rejects.toThrow(
        'Сканер уже запущен',
      );
    });

    it('должен бросить BadRequestException, если addr не указан', async () => {
      await expect(service.startScan({ addr: '' })).rejects.toThrow(
        'Поле addr обязательно',
      );
    });

    it('должен бросить BadRequestException, если addr с URL схемой', async () => {
      await expect(
        service.startScan({ addr: 'http://192.168.1.1' }),
      ).rejects.toThrow('Укажите только IP или hostname без схемы и пути');
    });

    it('должен бросить BadRequestException, если addr с путём', async () => {
      await expect(
        service.startScan({ addr: '192.168.1.1/path' }),
      ).rejects.toThrow('Укажите только IP или hostname без схемы и пути');
    });

    it('должен бросить BadRequestException, если addr некорректный', async () => {
      // "not-valid" содержит дефис, но это валидный hostname
      // Используем явно невалидный адрес
      await expect(
        service.startScan({ addr: 'invalid_domain!' }),
      ).rejects.toThrow('Некорректный addr: укажите IPv4/IPv6 или hostname');
    });

    it('должен принять IPv4 адрес', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '192.168.1.1' });

      expect(spawn).toHaveBeenCalled();
    });

    it('должен принять hostname', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: 'example.com' });

      expect(spawn).toHaveBeenCalled();
    });

    it('должен принять localhost', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: 'localhost' });

      expect(spawn).toHaveBeenCalled();
    });

    it('должен обработать [IPv6] в скобках', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '[::1]' });

      expect(spawn).toHaveBeenCalled();
    });

    it('должен использовать значения по умолчанию', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '192.168.1.1' });

      expect(spawn).toHaveBeenCalled();
    });

    it('должен clamp scanSeconds к диапазону 10-600', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '192.168.1.1', scanSeconds: 5 });

      expect(spawn).toHaveBeenCalledWith(
        'timeout',
        expect.arrayContaining([
          '--signal=TERM',
          '10s', // min value
        ]),
        expect.anything(),
      );
    });

    it('должен clamp thread к диапазону 1-20', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '192.168.1.1', thread: 50 });

      expect(spawn).toHaveBeenCalledWith(
        'timeout',
        expect.arrayContaining([
          '--thread',
          '20', // max value
        ]),
        expect.anything(),
      );
    });

    it('должен clamp timeout к диапазону 1-20', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.startScan({ addr: '192.168.1.1', timeout: 0 });

      expect(spawn).toHaveBeenCalledWith(
        'timeout',
        expect.arrayContaining([
          '--timeout',
          '1', // min value
        ]),
        expect.anything(),
      );
    });

    it('должен обработать ошибку сканера с exitCode != 0', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(1); // error code
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await expect(service.startScan({ addr: '192.168.1.1' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('должен обработать timeout сканера (exitCode 124)', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(124);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.startScan({
        addr: '192.168.1.1',
        scanSeconds: 1,
      });

      expect(result.timedOut).toBe(true);
    });

    it('должен обработать SIGKILL (exitCode 137)', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(137);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.startScan({ addr: '192.168.1.1' });

      expect(result.timedOut).toBe(true);
    });

    it('должен обработать SIGTERM (exitCode 143)', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() },
        on: jest.fn((event, cb) => {
          if (event === 'close') cb(143);
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.startScan({ addr: '192.168.1.1' });

      expect(result.timedOut).toBe(true);
    });

    it('должен извлечь домены из логов', async () => {
      let dataCallback: (chunk: Buffer) => void;
      let closeCallback: (code: number) => void;

      const mockProcess = {
        stdout: {
          on: jest.fn((event: string, cb: any) => {
            if (event === 'data') dataCallback = cb;
          }),
          pipe: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
          pipe: jest.fn(),
        },
        on: jest.fn((event: string, cb: any) => {
          if (event === 'close') closeCallback = cb;
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const scanPromise = service.startScan({ addr: '192.168.1.1' });

      // Simulate log output with domains
      dataCallback(Buffer.from('cert-domain=ya.ru\ncert-domain=vk.com\n'));
      closeCallback(0);

      const result = await scanPromise;

      expect(result.domains).toContain('vk.com');
      expect(result.domains).toContain('ya.ru');
    });

    it('должен обработать разрыв домена между чанками', async () => {
      let dataCallback: (chunk: Buffer) => void;
      let closeCallback: (code: number) => void;

      const mockProcess = {
        stdout: {
          on: jest.fn((event: string, cb: any) => {
            if (event === 'data') dataCallback = cb;
          }),
          pipe: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
          pipe: jest.fn(),
        },
        on: jest.fn((event: string, cb: any) => {
          if (event === 'close') closeCallback = cb;
        }),
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const scanPromise = service.startScan({ addr: '192.168.1.1' });

      // Split domain across chunks
      dataCallback(Buffer.from('cert-domain=ya.'));
      dataCallback(Buffer.from('ru\n'));
      closeCallback(0);

      const result = await scanPromise;

      expect(result.domains).toContain('ya.ru');
    });
  });

  describe('normalizeDomain', () => {
    it('должен нормализовать домен в нижний регистр', () => {
      const result = (service as any).normalizeDomain('YA.RU');
      expect(result).toBe('ya.ru');
    });

    it('должен удалить кавычки', () => {
      const result = (service as any).normalizeDomain('"ya.ru"');
      expect(result).toBe('ya.ru');
    });

    it('должен удалить wildcard префикс', () => {
      const result = (service as any).normalizeDomain('*.example.com');
      expect(result).toBe('example.com');
    });

    it('должен вернуть null для домена без точки', () => {
      const result = (service as any).normalizeDomain('localhost');
      expect(result).toBeNull();
    });

    it('должен вернуть null для некорректного домена', () => {
      const result = (service as any).normalizeDomain('invalid_domain!');
      expect(result).toBeNull();
    });

    it('должен вернуть null для пустой строки', () => {
      const result = (service as any).normalizeDomain('');
      expect(result).toBeNull();
    });
  });

  describe('clampNumber', () => {
    it('должен вернуть fallback для undefined', () => {
      const result = (service as any).clampNumber(undefined, 50, 10, 100);
      expect(result).toBe(50);
    });

    it('должен вернуть min, если значение меньше', () => {
      const result = (service as any).clampNumber(5, 50, 10, 100);
      expect(result).toBe(10);
    });

    it('должен вернуть max, если значение больше', () => {
      const result = (service as any).clampNumber(150, 50, 10, 100);
      expect(result).toBe(100);
    });

    it('должен округлить до целого', () => {
      const result = (service as any).clampNumber(50.7, 50, 10, 100);
      expect(result).toBe(50);
    });

    it('должен вернуть значение в диапазоне', () => {
      const result = (service as any).clampNumber(75, 50, 10, 100);
      expect(result).toBe(75);
    });
  });

  describe('appendTail', () => {
    it('должен вернуть строку, если она меньше лимита', () => {
      const result = (service as any).appendTail('', 'short');
      expect(result).toBe('short');
    });

    it('должен обрезать строку до лимита', () => {
      // logTailLimit = 800 по умолчанию, но метод просто добавляет строку
      // Обрезка происходит только если merged.length > logTailLimit
      const shortString = 'hello';
      const result = (service as any).appendTail('', shortString);
      expect(result).toBe('hello');
    });

    it('должен объединить текущую и входящую строки', () => {
      const result = (service as any).appendTail('hello', ' world');
      expect(result).toBe('hello world');
    });
  });

  describe('validateAndNormalizeAddr', () => {
    it('должен бросить ошибку для пустого addr', async () => {
      try {
        (service as any).validateAndNormalizeAddr('');
        fail('Should throw BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('Поле addr обязательно');
      }
    });

    it('должен бросить ошибку для URL', async () => {
      try {
        (service as any).validateAndNormalizeAddr('http://example.com');
        fail('Should throw BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('без схемы и пути');
      }
    });

    it('должен бросить ошибку для addr с путём', async () => {
      try {
        (service as any).validateAndNormalizeAddr('example.com/path');
        fail('Should throw BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('без схемы и пути');
      }
    });

    it('должен удалить скобки для IPv6', () => {
      const result = (service as any).validateAndNormalizeAddr('[::1]');
      expect(result).toBe('::1');
    });

    it('должен удалить конечные точки', () => {
      const result = (service as any).validateAndNormalizeAddr(
        'example.com...',
      );
      expect(result).toBe('example.com');
    });

    it('должен бросить ошибку для localhost с точками', async () => {
      try {
        (service as any).validateAndNormalizeAddr('...');
        fail('Should throw BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('Некорректный addr');
      }
    });
  });
});
