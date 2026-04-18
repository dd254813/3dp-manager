import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dns from 'dns/promises';
import * as net from 'net';
import { Repository } from 'typeorm';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Setting } from '../settings/entities/setting.entity';
import { COUNTRIES } from '../settings/countries';
import { XuiPanel } from './entities/xui-panel.entity';

interface XuiPanelPayload {
  name: string;
  url: string;
  login: string;
  password: string;
  isEnabled?: boolean;
  hysteriaEnabled?: boolean;
  hysteriaHost?: string;
  hysteriaPort?: number | string | null;
  hysteriaPassword?: string;
  hysteriaObfsPassword?: string;
  hysteriaSni?: string;
  hysteriaAllowInsecure?: boolean;
}

@Injectable()
export class XuiPanelsService {
  private readonly logger = new Logger(XuiPanelsService.name);

  constructor(
    @InjectRepository(XuiPanel)
    private panelsRepo: Repository<XuiPanel>,
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    @InjectRepository(Inbound)
    private inboundRepo: Repository<Inbound>,
  ) {}

  findAll() {
    return this.panelsRepo.find({ order: { id: 'ASC' } });
  }

  findEnabled() {
    return this.panelsRepo.find({
      where: { isEnabled: true },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const panel = await this.panelsRepo.findOne({ where: { id } });
    if (!panel) {
      throw new NotFoundException(`Панель 3x-ui ${id} не найдена`);
    }
    return panel;
  }

  async create(payload: XuiPanelPayload) {
    const prepared = await this.preparePanelData(payload);
    const panel = this.panelsRepo.create(prepared);
    const saved = await this.panelsRepo.save(panel);
    await this.syncLegacyPrimarySettings();
    return saved;
  }

  async update(id: number, payload: Partial<XuiPanelPayload>) {
    const current = await this.findOne(id);
    const prepared = await this.preparePanelData({
      name: payload.name ?? current.name,
      url: payload.url ?? current.url,
      login: payload.login ?? current.login,
      password: payload.password ?? current.password,
      isEnabled: payload.isEnabled ?? current.isEnabled,
      hysteriaEnabled: payload.hysteriaEnabled ?? current.hysteriaEnabled,
      hysteriaHost: payload.hysteriaHost ?? current.hysteriaHost,
      hysteriaPort: payload.hysteriaPort ?? current.hysteriaPort,
      hysteriaPassword: payload.hysteriaPassword ?? current.hysteriaPassword,
      hysteriaObfsPassword:
        payload.hysteriaObfsPassword ?? current.hysteriaObfsPassword,
      hysteriaSni: payload.hysteriaSni ?? current.hysteriaSni,
      hysteriaAllowInsecure:
        payload.hysteriaAllowInsecure ?? current.hysteriaAllowInsecure,
    });

    Object.assign(current, prepared);
    const saved = await this.panelsRepo.save(current);
    await this.syncLegacyPrimarySettings();
    return saved;
  }

  async remove(id: number) {
    const panel = await this.findOne(id);
    await this.inboundRepo.delete({ xuiPanelId: id });
    await this.panelsRepo.remove(panel);
    await this.syncLegacyPrimarySettings();
    return { success: true };
  }

  private async preparePanelData(payload: XuiPanelPayload) {
    const name = payload.name?.trim();
    const url = payload.url?.trim().replace(/\/+$/, '');
    const login = payload.login?.trim();
    const password = payload.password?.trim();
    const hysteriaEnabled = payload.hysteriaEnabled ?? false;
    const hysteriaHost = this.normalizeOptionalString(payload.hysteriaHost);
    const hysteriaPassword = this.normalizeOptionalString(
      payload.hysteriaPassword,
    );
    const hysteriaObfsPassword = this.normalizeOptionalString(
      payload.hysteriaObfsPassword,
    );
    const hysteriaSni = this.normalizeOptionalString(payload.hysteriaSni);
    const hysteriaAllowInsecure = payload.hysteriaAllowInsecure ?? false;

    if (!name) {
      throw new BadRequestException('Введите название панели');
    }

    if (!url) {
      throw new BadRequestException('Введите URL панели');
    }

    if (!login) {
      throw new BadRequestException('Введите логин панели');
    }

    if (!password) {
      throw new BadRequestException('Введите пароль панели');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException('Некорректный URL панели');
    }

    let hysteriaPort: number | null = null;
    if (
      payload.hysteriaPort !== undefined &&
      payload.hysteriaPort !== null &&
      `${payload.hysteriaPort}`.trim().length > 0
    ) {
      hysteriaPort =
        typeof payload.hysteriaPort === 'string'
          ? parseInt(payload.hysteriaPort, 10)
          : payload.hysteriaPort;

      if (
        !Number.isFinite(hysteriaPort) ||
        hysteriaPort <= 0 ||
        hysteriaPort > 65535
      ) {
        throw new BadRequestException('Некорректный порт Hysteria2');
      }
    }

    if (hysteriaEnabled) {
      if (!hysteriaHost) {
        throw new BadRequestException('Введите host для Hysteria2');
      }
      if (!hysteriaPort) {
        throw new BadRequestException('Введите порт для Hysteria2');
      }
      if (!hysteriaPassword) {
        throw new BadRequestException('Введите пароль Hysteria2');
      }
      if (!hysteriaObfsPassword) {
        throw new BadRequestException('Введите obfs пароль Hysteria2');
      }
    }

    const host = parsedUrl.hostname;
    let ip = '';
    let geoCountry = '';
    let geoFlag = '';

    try {
      if (net.isIP(host) === 0) {
        const result = await dns.lookup(host);
        ip = result.address;
      } else {
        ip = host;
      }
    } catch (error) {
      this.logger.warn(
        `Не удалось определить IP для панели ${url}: ${(error as Error).message}`,
      );
    }

    if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
        const geoData = (await geoRes.json()) as {
          status: string;
          country?: string;
          countryCode?: string;
        };

        if (geoData.status === 'success') {
          const countryInfo = COUNTRIES.find(
            (country) => country.code === geoData.countryCode,
          );

          geoCountry = countryInfo?.name || geoData.country || '';
          geoFlag = countryInfo?.emoji || '';
        }
      } catch (error) {
        this.logger.warn(
          `GeoIP lookup failed for ${ip}: ${(error as Error).message}`,
        );
      }
    }

    return {
      name,
      url,
      login,
      password,
      host,
      ip,
      geoCountry,
      geoFlag,
      isEnabled: payload.isEnabled ?? true,
      hysteriaEnabled,
      hysteriaHost,
      hysteriaPort,
      hysteriaPassword,
      hysteriaObfsPassword,
      hysteriaSni,
      hysteriaAllowInsecure,
    };
  }

  private normalizeOptionalString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async syncLegacyPrimarySettings() {
    const panels = await this.findEnabled();
    const primaryPanel = panels[0] || null;

    const legacySettings = primaryPanel
      ? {
          xui_url: primaryPanel.url,
          xui_login: primaryPanel.login,
          xui_password: primaryPanel.password,
          xui_host: primaryPanel.host || '',
          xui_ip: primaryPanel.ip || '',
          xui_geo_country: primaryPanel.geoCountry || '',
          xui_geo_flag: primaryPanel.geoFlag || '',
        }
      : {
          xui_url: '',
          xui_login: '',
          xui_password: '',
          xui_host: '',
          xui_ip: '',
          xui_geo_country: '',
          xui_geo_flag: '',
        };

    for (const [key, value] of Object.entries(legacySettings)) {
      await this.saveSetting(key, value);
    }
  }

  private async saveSetting(key: string, value: string) {
    let setting = await this.settingsRepo.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingsRepo.create({ key });
    }
    setting.value = value;
    await this.settingsRepo.save(setting);
  }
}
