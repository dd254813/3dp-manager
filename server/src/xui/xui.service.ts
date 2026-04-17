import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as https from 'https';
import { SessionService } from '../session/session.service';
import { XuiPanel } from './entities/xui-panel.entity';
import { XuiPanelsService } from './xui-panels.service';
import { XuiResponse, XuiCertResult, XuiInboundRaw } from './xui.types';

interface LoginResponse {
  success: boolean;
}

@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);

  constructor(
    private sessionService: SessionService,
    private panelsService: XuiPanelsService,
  ) {}

  findAllPanels() {
    return this.panelsService.findAll();
  }

  getEnabledPanels() {
    return this.panelsService.findEnabled();
  }

  getPanel(panelId: number) {
    return this.panelsService.findOne(panelId);
  }

  private createApi(panel: XuiPanel): AxiosInstance {
    const api = axios.create({
      baseURL: panel.url,
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      withCredentials: true,
    });

    api.interceptors.request.use((config) => {
      const cookie = this.sessionService.getCookie(panel.id);
      if (cookie) {
        config.headers['Cookie'] = cookie;
      }
      return config;
    });

    return api;
  }

  async login(panelId: number) {
    const panel = await this.panelsService.findOne(panelId);
    return this.loginPanel(panel);
  }

  async loginPanel(panel: XuiPanel) {
    try {
      if (!panel.url || !panel.login || !panel.password) {
        this.logger.warn(`Настройки панели ${panel.name} заполнены не полностью`);
        return false;
      }

      this.logger.log(`Attempting login to 3x-ui panel ${panel.name}: ${panel.url}`);
      const api = this.createApi(panel);

      const res = await api.post<LoginResponse>('/login', {
        username: panel.login,
        password: panel.password,
      });

      if (res.headers['set-cookie'] && res.data?.success) {
        this.sessionService.setFromHeaders(panel.id, res.headers['set-cookie']);
        this.logger.log(`3x-ui login successful for panel ${panel.name}`);
        return true;
      }

      this.logger.warn(`3x-ui login failed for panel ${panel.name}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `3x-ui login error for panel ${panel.name}: ${axiosError.message}`,
      );
    }

    return false;
  }

  async addInbound(
    panelId: number,
    inboundConfig: { port: number; [key: string]: unknown } | XuiInboundRaw,
  ): Promise<number | null> {
    const panel = await this.panelsService.findOne(panelId);
    let attempts = 0;
    const maxAttempts = 3;
    let currentConfig = { ...inboundConfig };

    this.logger.log(
      `Adding inbound on panel ${panel.name} using port ${currentConfig.port}`,
    );

    while (attempts < maxAttempts) {
      attempts++;
      const api = this.createApi(panel);

      try {
        const res = await api.post<XuiResponse<{ id: number }>>(
          '/panel/api/inbounds/add',
          currentConfig,
        );

        if (res.data?.success) {
          this.logger.log(
            `Inbound created on panel ${panel.name} with ID: ${res.data.obj.id}`,
          );
          return res.data.obj.id;
        }

        const message = res.data?.msg || '';
        if (
          message.toLowerCase().includes('port') &&
          message.toLowerCase().includes('exists')
        ) {
          this.logger.warn(
            `Порт ${currentConfig.port} занят на панели ${panel.name}, подбираем новый`,
          );
          currentConfig = {
            ...currentConfig,
            port: Math.floor(Math.random() * (60000 - 10000 + 1) + 10000),
          };
          continue;
        }

        this.logger.error(
          `3x-ui отклонил создание на панели ${panel.name}: ${message}`,
        );
        return null;
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 401) {
          this.logger.log(
            `Сессия панели ${panel.name} истекла, пробуем перелогин`,
          );
          if (await this.loginPanel(panel)) {
            continue;
          }
        }

        this.logger.error(
          `Ошибка добавления инбаунда на панели ${panel.name}: ${axiosError.message}`,
        );
        return null;
      }
    }

    this.logger.error(
      `Не удалось создать инбаунд на панели ${panel.name} после ${maxAttempts} попыток`,
    );
    return null;
  }

  async deleteInbound(panelId: number, inboundId: number, retried = false) {
    try {
      const panel = await this.panelsService.findOne(panelId);
      const api = this.createApi(panel);

      await api.post(`/panel/api/inbounds/del/${inboundId}`);
      this.logger.debug(`Инбаунд ${inboundId} удален с панели ${panel.name}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (
        axiosError.response?.status === 401 &&
        !retried
      ) {
        try {
          const panel = await this.panelsService.findOne(panelId);
          if (await this.loginPanel(panel)) {
            await this.deleteInbound(panelId, inboundId, true);
            return;
          }
        } catch {
          return;
        }
      }

      this.logger.error(
        `Ошибка удаления инбаунда ${inboundId} с панели ${panelId}: ${axiosError.message}`,
      );
    }
  }

  async checkConnection(url: string, username: string, pass: string): Promise<boolean> {
    try {
      this.logger.log(`Checking connection to 3x-ui: ${url}`);

      const tempApi = axios.create({
        baseURL: url,
        timeout: 5000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        withCredentials: true,
      });

      const res = await tempApi.post<LoginResponse>('/login', {
        username,
        password: pass,
      });

      if (res.headers['set-cookie'] && res.data?.success) {
        this.logger.log(`Connection to 3x-ui successful: ${url}`);
        return true;
      }

      this.logger.warn('Connection failed: Invalid credentials or no cookie received');
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(`Connection error: ${axiosError.message} (URL: ${url})`);
    }

    return false;
  }

  async getNewX25519Cert(panelId: number, retried = false): Promise<XuiCertResult | null> {
    try {
      const panel = await this.panelsService.findOne(panelId);
      const api = this.createApi(panel);
      const res = await api.get<XuiResponse<XuiCertResult>>(
        '/panel/api/server/getNewX25519Cert',
      );

      if (res.data?.success && res.data.obj) {
        return res.data.obj;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401 && !retried) {
        const panel = await this.panelsService.findOne(panelId);
        if (await this.loginPanel(panel)) {
          return this.getNewX25519Cert(panelId, true);
        }
      }

      this.logger.error(
        `Ошибка получения Reality ключей для панели ${panelId}: ${axiosError.message}`,
      );
    }

    return null;
  }
}
