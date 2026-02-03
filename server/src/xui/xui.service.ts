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
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const res = await this.api.post('/panel/api/inbounds/add', inboundConfig);

        if (res.data?.success) {
          return res.data.obj.id;
        } 
        
        else {
          const msg = res.data?.msg || '';
          
          if (
            msg.toLowerCase().includes('port') && 
            msg.toLowerCase().includes('exists')
          ) {
            this.logger.warn(`Попытка ${attempts}/${maxAttempts}: Порт ${inboundConfig.port} занят. Генерируем новый...`);
            
            inboundConfig.port = Math.floor(Math.random() * (60000 - 10000 + 1) + 10000);
            
          } else {
            this.logger.error(`3x-ui отклонил создание: ${msg}`);
            return null;
          }
        }

      } catch (e) {
        if (e.response?.status === 401) {
          this.logger.log('Сессия истекла, пробуем релогин...');
          if (await this.login()) {
            return this.addInbound(inboundConfig);
          }
        }
        
        this.logger.error(`Ошибка сети/валидации при добавлении инбаунда: ${e.message}`);
        return null;
      }
    }

    this.logger.error(`Не удалось создать инбаунд после ${maxAttempts} попыток смены порта.`);
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

  async checkConnection(url: string, username: string, pass: string): Promise<boolean> {
    try {
      const tempApi = axios.create({
        baseURL: url,
        timeout: 5000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        withCredentials: true
      });

      const res = await tempApi.post('/login', {
        username: username,
        password: pass,
      });

      if (res.headers['set-cookie'] && res.data?.success) {
        return true;
      }
    } catch (e) {
      this.logger.warn(`Ошибка авторизации: ${e.message}`);
    }
    return false;
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