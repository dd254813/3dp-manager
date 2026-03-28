import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';
import { Setting } from '../settings/entities/setting.entity';
import { XuiResponse, XuiCertResult, XuiInboundRaw } from './xui.types';
import { SessionService } from '../session/session.service';

interface LoginResponse {
  success: boolean;
}

@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);
  private api: AxiosInstance;

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private sessionService: SessionService,
  ) {
    this.api = axios.create({
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const cookie = this.sessionService.getCookie();
      if (cookie) {
        config.headers['Cookie'] = cookie;
      }
      return config;
    });
  }

  private async getSettings() {
    const settings = await this.settingsRepo.find();
    const config: Record<string, string> = {};
    settings.forEach((s) => (config[s.key] = s.value));
    return config;
  }

  async login() {
    try {
      const config = await this.getSettings();
      if (
        !config['xui_url'] ||
        !config['xui_login'] ||
        !config['xui_password']
      ) {
        this.logger.warn('Настройки 3x-ui не заполнены в БД');
        return false;
      }

      this.logger.log(`Attempting login to 3x-ui: ${config['xui_url']}`);
      this.api.defaults.baseURL = config['xui_url'];

      const res = await this.api.post<LoginResponse>('/login', {
        username: config['xui_login'],
        password: config['xui_password'],
      });

      if (res.headers['set-cookie']) {
        this.sessionService.setFromHeaders(res.headers['set-cookie']);
        this.logger.log('3x-ui login successful');
        return true;
      } else {
        this.logger.warn('3x-ui login failed: No cookie received');
      }
    } catch (e) {
      const error = e as AxiosError;
      this.logger.error(`3x-ui login error: ${error.message}`);
    }
    return false;
  }

  async addInbound(
    inboundConfig: { port: number; [key: string]: unknown } | XuiInboundRaw,
  ): Promise<number | null> {
    let attempts = 0;
    const maxAttempts = 3;

    this.logger.log(`Adding inbound on port ${inboundConfig.port}`);

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const res = await this.api.post<XuiResponse<{ id: number }>>(
          '/panel/api/inbounds/add',
          inboundConfig,
        );

        if (res.data?.success) {
          this.logger.log(
            `Inbound created successfully with ID: ${res.data.obj.id}`,
          );
          return res.data.obj.id;
        } else {
          const msg = res.data?.msg || '';

          if (
            msg.toLowerCase().includes('port') &&
            msg.toLowerCase().includes('exists')
          ) {
            this.logger.warn(
              `Попытка ${attempts}/${maxAttempts}: Порт ${inboundConfig.port} занят. Генерируем новый...`,
            );

            inboundConfig.port = Math.floor(
              Math.random() * (60000 - 10000 + 1) + 10000,
            );
          } else {
            this.logger.error(`3x-ui отклонил создание: ${msg}`);
            return null;
          }
        }
      } catch (e) {
        const error = e as AxiosError;
        if (error.response?.status === 401) {
          this.logger.log('Сессия истекла, пробуем релогин...');
          if (await this.login()) {
            return this.addInbound(inboundConfig);
          }
        }

        this.logger.error(
          `Ошибка сети/валидации при добавлении инбаунда: ${error.message}`,
        );
        return null;
      }
    }

    this.logger.error(
      `Не удалось создать инбаунд после ${maxAttempts} попыток смены порта.`,
    );
    return null;
  }

  async deleteInbound(id: number) {
    try {
      await this.api.post(`/panel/api/inbounds/del/${id}`);
      this.logger.debug(`Инбаунд ${id} удален`);
    } catch (e) {
      const error = e as AxiosError;
      this.logger.error(`Ошибка удаления инбаунда ${id}: ${error.message}`);
    }
  }

  async checkConnection(
    url: string,
    username: string,
    pass: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`Checking connection to 3x-ui: ${url}`);

      const tempApi = axios.create({
        baseURL: url,
        timeout: 5000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        withCredentials: true,
      });

      const res = await tempApi.post<LoginResponse>('/login', {
        username: username,
        password: pass,
      });

      if (res.headers['set-cookie'] && res.data?.success) {
        this.logger.log(`Connection to 3x-ui successful: ${url}`);
        return true;
      } else {
        this.logger.warn(
          `Connection failed: Invalid credentials or no cookie received`,
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Connection error: ${axiosError.message} (URL: ${url})`,
      );
    }
    return false;
  }

  async getNewX25519Cert(): Promise<XuiCertResult | null> {
    try {
      const res = await this.api.get<XuiResponse<XuiCertResult>>(
        '/panel/api/server/getNewX25519Cert',
      );
      if (res.data?.success && res.data.obj) return res.data.obj;
    } catch {
      this.logger.error('Ошибка получения ключей Reality');
    }
    return null;
  }
}
