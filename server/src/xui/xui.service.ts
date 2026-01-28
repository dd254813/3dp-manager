import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { Setting } from '../settings/entities/setting.entity';

@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);
  private api: AxiosInstance;
  private cookie: string | null = null;

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
  ) {
    this.api = axios.create({
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      if (this.cookie) {
        config.headers['Cookie'] = this.cookie;
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
      if (!config['xui_url'] || !config['xui_login'] || !config['xui_password']) {
        this.logger.warn('Настройки 3x-ui не заполнены в БД');
        return false;
      }

      this.api.defaults.baseURL = config['xui_url'];

      const res = await this.api.post('/login', {
        username: config['xui_login'],
        password: config['xui_password'],
      });

      if (res.headers['set-cookie']) {
        this.cookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        this.logger.log('Успешная авторизация в 3x-ui');
        return true;
      }
    } catch (e) {
      this.logger.error(`Ошибка авторизации: ${e.message}`);
    }
    return false;
  }

  async addInbound(inboundConfig: any) {
    try {
      const res = await this.api.post('/panel/api/inbounds/add', inboundConfig);
      if (res.data?.success) {
        this.logger.log(res.data?.msg);
        return res.data.obj.id;
      } else {
        this.logger.error(res.data?.msg);
      }
    } catch (e) {
      this.logger.error(`Ошибка добавления инбаунда: ${e.message}`);
      if (e.response?.status === 401) {
        this.logger.log('Сессия истекла, пробуем релогин...');
        if (await this.login()) {
          return this.addInbound(inboundConfig);
        }
      }
    }
    return null;
  }

  async deleteInbound(id: number) {
    try {
      await this.api.post(`/panel/api/inbounds/del/${id}`);
      this.logger.log(`Инбаунд ${id} удален`);
    } catch (e) {
      this.logger.error(`Ошибка удаления инбаунда ${id}: ${e.message}`);
    }
  }

  async getNewX25519Cert() {
    try {
      const res = await this.api.get('/panel/api/server/getNewX25519Cert');
      if (res.data?.success) return res.data.obj;
    } catch (e) {
      this.logger.error('Ошибка получения ключей Reality');
    }
    return null;
  }
}