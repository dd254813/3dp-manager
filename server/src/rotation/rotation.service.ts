import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Setting } from '../settings/entities/setting.entity';
import { XuiPanel } from '../xui/entities/xui-panel.entity';

import { XuiService } from '../xui/xui.service';
import { InboundBuilderService } from '../inbounds/inbound-builder.service';
import { XuiInboundRaw } from '../inbounds/xui-inbound.types';
import { v4 as uuidv4 } from 'uuid';

const REALITY_TYPES = new Set([
  'vless-tcp-reality',
  'vless-xhttp-reality',
  'vless-grpc-reality',
  'trojan-tcp-reality',
]);

const PANEL_BOUND_TYPES = new Set([
  ...REALITY_TYPES,
  'vless-ws',
  'vmess-tcp',
  'shadowsocks-tcp',
]);

@Injectable()
export class RotationService implements OnModuleInit {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Inbound) private inboundRepo: Repository<Inbound>,
    @InjectRepository(Domain) private domainRepo: Repository<Domain>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    private xuiService: XuiService,
    private inboundBuilder: InboundBuilderService,
  ) {}

  async onModuleInit() {
    await this.initDefaultSettings();
  }

  private async initDefaultSettings() {
    const statusKey = 'rotation_status';
    const intervalKey = 'rotation_interval';
    const lastRunKey = 'last_rotation_timestamp';

    const existingStatus = await this.settingRepo.findOne({
      where: { key: statusKey },
    });
    if (!existingStatus) {
      this.logger.debug(`Инициализация настройки: ${statusKey} = active`);
      const newSetting = this.settingRepo.create({
        key: statusKey,
        value: 'active',
      });
      await this.settingRepo.save(newSetting);
    } else {
      this.logger.debug(`Текущий статус ротации: ${existingStatus.value}`);
    }

    const existingInterval = await this.settingRepo.findOne({
      where: { key: intervalKey },
    });
    if (!existingInterval) {
      this.logger.debug(`Инициализация настройки: ${intervalKey} = 30`);
      const newSetting = this.settingRepo.create({
        key: intervalKey,
        value: '30',
      });
      await this.settingRepo.save(newSetting);
    }

    const existingLastRun = await this.settingRepo.findOne({
      where: { key: lastRunKey },
    });
    if (!existingLastRun) {
      const now = Date.now();
      this.logger.debug(`Инициализация настройки: ${lastRunKey} = ${now}`);
      const newSetting = this.settingRepo.create({
        key: lastRunKey,
        value: now.toString(),
      });
      await this.settingRepo.save(newSetting);
    } else {
      this.logger.debug(`Последняя ротация: ${existingLastRun.value}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTicker() {
    const intervalSetting = await this.settingRepo.findOne({
      where: { key: 'rotation_interval' },
    });
    const intervalMinutes = intervalSetting
      ? parseInt(intervalSetting.value, 10)
      : 30;

    const lastRunSetting = await this.settingRepo.findOne({
      where: { key: 'last_rotation_timestamp' },
    });
    const lastRun = lastRunSetting ? parseInt(lastRunSetting.value, 10) : 0;

    const now = Date.now();
    const diffMinutes = (now - lastRun) / 1000 / 60;
    const statusSetting = await this.settingRepo.findOne({
      where: { key: 'rotation_status' },
    });
    const isStopped = statusSetting?.value === 'stopped';

    this.logger.debug(
      `Планировщик: интервал=${intervalMinutes}мин, прошло=${diffMinutes.toFixed(1)}мин, статус=${isStopped ? 'stopped' : 'active'}`,
    );

    if (diffMinutes < intervalMinutes || isStopped) {
      return;
    }

    this.logger.debug(
      `Запуск ротации (прошло ${diffMinutes.toFixed(1)}мин при интервале ${intervalMinutes}мин)`,
    );
    await this.performRotation();

    await this.saveSetting('last_rotation_timestamp', now.toString());
  }

  private async saveSetting(key: string, value: string) {
    let setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingRepo.create({ key });
    }
    setting.value = value;
    await this.settingRepo.save(setting);
  }

  async performRotation() {
    this.logger.debug('Запуск плановой ротации...');

    const { availablePanels, failedPanels } = await this.getAvailablePanels();
    const totalPanels = availablePanels.length + failedPanels.length;

    if (totalPanels === 0) {
      return {
        success: false,
        message: 'Не добавлено ни одной панели 3x-ui',
      };
    }

    if (availablePanels.length === 0) {
      return {
        success: false,
        message: 'Не удалось войти ни в одну панель 3x-ui',
      };
    }

    const subscriptions = await this.subRepo.find({
      where: {
        isEnabled: true,
        isAutoRotationEnabled: true,
      },
      relations: ['inbounds'],
    });
    if (subscriptions.length === 0) {
      return {
        success: false,
        message: 'Нет активных подписок для ротации',
      };
    }

    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    if (domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    for (const sub of subscriptions) {
      await this.rotateSubscription(sub, domains, availablePanels);
    }

    this.logger.debug('Ротация завершена.');
    return {
      success: true,
      message: this.buildPanelSummaryMessage(availablePanels, failedPanels),
    };
  }

  private async getAvailablePanels() {
    const panels = await this.xuiService.getEnabledPanels();
    const availablePanels: XuiPanel[] = [];
    const failedPanels: XuiPanel[] = [];

    for (const panel of panels) {
      if (await this.xuiService.login(panel.id)) {
        availablePanels.push(panel);
      } else {
        failedPanels.push(panel);
      }
    }

    return { availablePanels, failedPanels };
  }

  private buildPanelSummaryMessage(
    availablePanels: XuiPanel[],
    failedPanels: XuiPanel[],
  ) {
    if (failedPanels.length === 0) {
      return `Ротация успешно выполнена для ${availablePanels.length} панелей`;
    }

    const failedNames = failedPanels.map((panel) => panel.name).join(', ');
    return `Ротация выполнена частично: ${availablePanels.length}/${availablePanels.length + failedPanels.length} панелей доступны. Недоступны: ${failedNames}`;
  }

  private async rotateSubscription(
    sub: Subscription,
    domains: Domain[],
    availablePanels: XuiPanel[],
  ) {
    this.logger.debug(`Ротация для подписки: ${sub.name} (${sub.uuid})`);

    const availablePanelIds = new Set(availablePanels.map((panel) => panel.id));

    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        const isSingletonInbound = inbound.xuiPanelId === null;
        const isAvailablePanelInbound =
          inbound.xuiPanelId !== null && availablePanelIds.has(inbound.xuiPanelId);

        if (!isSingletonInbound && !isAvailablePanelInbound) {
          continue;
        }

        if (inbound.xuiId > 0 && inbound.xuiPanelId) {
          await this.xuiService.deleteInbound(inbound.xuiPanelId, inbound.xuiId);
        }

        await this.inboundRepo.delete(inbound.id);
      }
    }

    await this.createSingletonInbounds(sub, domains, availablePanels[0]);

    for (const panel of availablePanels) {
      await this.createPanelInbounds(sub, domains, panel);
    }
  }

  private async createSingletonInbounds(
    sub: Subscription,
    domains: Domain[],
    primaryPanel?: XuiPanel,
  ) {
    const inboundsConfig = sub.inboundsConfig || [];
    const serverAddress = primaryPanel?.host || 'localhost';
    const flagEmoji = primaryPanel?.geoFlag || '%F0%9F%92%AF';

    for (const config of inboundsConfig) {
      if (config.type === 'custom') {
        const newInbound = this.inboundRepo.create({
          xuiId: 0,
          xuiPanelId: null,
          port: 0,
          protocol: 'custom',
          remark: 'custom-link',
          link: config.link || '',
          subscription: sub,
        });
        await this.inboundRepo.save(newInbound);
        continue;
      }

      if (config.type === 'hysteria2-udp') {
        const sni =
          config.sni === 'random' ? this.pickDomain(domains) : config.sni || this.pickDomain(domains);
        const link = this.inboundBuilder.buildHysteria2Link(
          serverAddress,
          sni,
          `${flagEmoji}%20hysteria2-udp`,
        );
        const newInbound = this.inboundRepo.create({
          xuiId: 0,
          xuiPanelId: null,
          port: 0,
          protocol: 'hysteria2',
          remark: 'hysteria2-udp',
          link,
          subscription: sub,
        });
        await this.inboundRepo.save(newInbound);
      }
    }
  }

  private async createPanelInbounds(
    sub: Subscription,
    domains: Domain[],
    panel: XuiPanel,
  ) {
    const inboundsConfig = (sub.inboundsConfig || []).filter((config) =>
      PANEL_BOUND_TYPES.has(config.type || ''),
    );

    if (inboundsConfig.length === 0) {
      return;
    }

    const needsRealityKeys = inboundsConfig.some((config) =>
      REALITY_TYPES.has(config.type || ''),
    );
    const keys = needsRealityKeys
      ? await this.xuiService.getNewX25519Cert(panel.id)
      : null;

    if (needsRealityKeys && !keys) {
      this.logger.warn(
        `Reality ключи для панели ${panel.name} не получены. Reality-инбаунды будут пропущены`,
      );
    }

    const usedPorts = new Set<number>();
    const serverAddress = panel.host || 'localhost';
    const flagEmoji = panel.geoFlag || '%F0%9F%92%AF';

    for (const config of inboundsConfig) {
      const type = config.type || '';

      if (REALITY_TYPES.has(type) && !keys) {
        continue;
      }

      const uuid = uuidv4();
      const sni =
        config.sni === 'random' ? this.pickDomain(domains) : config.sni || this.pickDomain(domains);

      let port: number;
      if (config.port === 'random' || !config.port) {
        port = await this.getFreePort(0, usedPorts, panel.id);
      } else {
        port =
          typeof config.port === 'string'
            ? parseInt(config.port, 10)
            : config.port;

        if (!Number.isFinite(port) || port <= 0) {
          port = await this.getFreePort(0, usedPorts, panel.id);
        }
      }
      usedPorts.add(port);

      let xuiConfig: XuiInboundRaw | null = null;

      switch (type) {
        case 'vless-tcp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityTcp({
            port,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-xhttp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityXhttp({
            port,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-grpc-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityGrpc({
            port,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-ws':
          xuiConfig = this.inboundBuilder.buildVlessWs({ port, uuid, sni });
          break;
        case 'vmess-tcp':
          xuiConfig = this.inboundBuilder.buildVmessTcp({ port, uuid });
          break;
        case 'shadowsocks-tcp':
          xuiConfig = this.inboundBuilder.buildShadowsocksTcp({ port, uuid });
          break;
        case 'trojan-tcp-reality':
          xuiConfig = this.inboundBuilder.buildTrojanRealityTcp({
            port,
            uuid,
            sni,
            ...keys!,
          });
          break;
        default:
          this.logger.warn(`Неизвестный тип инбаунда: ${type}`);
          continue;
      }

      const xuiId = await this.xuiService.addInbound(panel.id, xuiConfig);

      if (xuiId && xuiConfig) {
        const settings = JSON.parse(xuiConfig.settings) as {
          clients?: Array<{ id?: string; password?: string }>;
        };
        const idOrPass =
          settings.clients?.[0]?.id || settings.clients?.[0]?.password || '';

        const fullLink = this.inboundBuilder.buildInboundLink(
          xuiConfig,
          serverAddress,
          idOrPass,
          flagEmoji,
        );

        const newInbound = this.inboundRepo.create({
          xuiId,
          xuiPanelId: panel.id,
          port,
          protocol: xuiConfig.protocol,
          remark: xuiConfig.remark,
          link: fullLink,
          subscription: sub,
        });
        await this.inboundRepo.save(newInbound);
      }
    }
  }

  private pickDomain(list: Domain[]): string {
    return list[Math.floor(Math.random() * list.length)].name;
  }

  private async getFreePort(
    preferred: number,
    currentBatch: Set<number>,
    panelId: number,
  ): Promise<number> {
    if (preferred > 0 && !currentBatch.has(preferred)) {
      const existing = await this.inboundRepo.findOne({
        where: { port: preferred, xuiPanelId: panelId },
      });
      if (!existing) {
        return preferred;
      }
    }

    while (true) {
      const port = Math.floor(Math.random() * (60000 - 10000)) + 10000;
      if (currentBatch.has(port)) {
        continue;
      }

      const existing = await this.inboundRepo.findOne({
        where: { port, xuiPanelId: panelId },
      });
      if (!existing) {
        return port;
      }
    }
  }

  async rotateSingleSubscription(subscriptionId: string) {
    this.logger.debug(`Запуск ручной ротации подписки: ${subscriptionId}`);

    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: ['inbounds'],
    });

    if (!sub) {
      this.logger.warn(`Подписка не найдена: ${subscriptionId}`);
      return {
        success: false,
        message: 'Подписка не найдена',
      };
    }

    const { availablePanels, failedPanels } = await this.getAvailablePanels();
    const totalPanels = availablePanels.length + failedPanels.length;

    if (totalPanels === 0) {
      return {
        success: false,
        message: 'Не добавлено ни одной панели 3x-ui',
      };
    }

    if (availablePanels.length === 0) {
      return {
        success: false,
        message: 'Не удалось войти ни в одну панель 3x-ui',
      };
    }

    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    if (domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    await this.rotateSubscription(sub, domains, availablePanels);

    this.logger.debug(`Ручная ротация подписки ${subscriptionId} завершена.`);
    return {
      success: true,
      message: this.buildPanelSummaryMessage(availablePanels, failedPanels),
    };
  }
}
