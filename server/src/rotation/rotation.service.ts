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
import { TunnelsService } from '../tunnels/tunnels.service';
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
  'hysteria2-udp',
]);

interface TunnelSyncResult {
  syncedCount: number;
  totalCount: number;
  failedNames: string[];
}

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
    private tunnelsService: TunnelsService,
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

    const needsPanels = subscriptions.some((sub) => this.hasPanelBoundConfigs(sub));
    const { availablePanels, failedPanels } = await this.getAvailablePanels();
    const totalPanels = availablePanels.length + failedPanels.length;

    if (needsPanels && totalPanels === 0) {
      return {
        success: false,
        message: 'Не добавлено ни одной панели 3x-ui',
      };
    }

    if (needsPanels && availablePanels.length === 0) {
      return {
        success: false,
        message: 'Не удалось войти ни в одну панель 3x-ui',
      };
    }

    const domains = needsPanels
      ? await this.domainRepo.find({ where: { isEnabled: true } })
      : [];
    if (needsPanels && domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    for (const sub of subscriptions) {
      await this.rotateSubscription(sub, domains, availablePanels);
    }

    const tunnelSync = await this.tunnelsService.syncInstalledTunnels();

    this.logger.debug('Ротация завершена.');
    return {
      success: true,
      message: this.buildResultMessage(
        availablePanels,
        failedPanels,
        tunnelSync,
      ),
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
    if (availablePanels.length === 0 && failedPanels.length === 0) {
      return 'Обновление завершено';
    }

    if (failedPanels.length === 0) {
      return `Ротация успешно выполнена для ${availablePanels.length} панелей`;
    }

    const failedNames = failedPanels.map((panel) => panel.name).join(', ');
    return `Ротация выполнена частично: ${availablePanels.length}/${availablePanels.length + failedPanels.length} панелей доступны. Недоступны: ${failedNames}`;
  }

  private buildResultMessage(
    availablePanels: XuiPanel[],
    failedPanels: XuiPanel[],
    tunnelSync: TunnelSyncResult,
  ) {
    let message = this.buildPanelSummaryMessage(availablePanels, failedPanels);

    if (tunnelSync.totalCount > 0) {
      if (tunnelSync.failedNames.length === 0) {
        message += `. Relay sync: ${tunnelSync.syncedCount}/${tunnelSync.totalCount}`;
      } else {
        message += `. Relay sync: ${tunnelSync.syncedCount}/${tunnelSync.totalCount}. Ошибки: ${tunnelSync.failedNames.join(', ')}`;
      }
    }

    return message;
  }

  private hasPanelBoundConfigs(sub: Subscription) {
    return (sub.inboundsConfig || []).some((config) =>
      PANEL_BOUND_TYPES.has(config.type || ''),
    );
  }

  private getSelectedPanelIds(sub: Subscription) {
    if (!Array.isArray(sub.xuiPanelIds)) {
      return null;
    }

    return new Set(
      sub.xuiPanelIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
  }

  private filterPanelsForSubscription(sub: Subscription, panels: XuiPanel[]) {
    const selectedPanelIds = this.getSelectedPanelIds(sub);
    if (!selectedPanelIds) {
      return panels;
    }

    return panels.filter((panel) => selectedPanelIds.has(panel.id));
  }

  private async rotateSubscription(
    sub: Subscription,
    domains: Domain[],
    availablePanels: XuiPanel[],
  ) {
    this.logger.debug(`Ротация для подписки: ${sub.name} (${sub.uuid})`);

    const selectedPanelIds = this.getSelectedPanelIds(sub);
    const targetPanels = this.filterPanelsForSubscription(sub, availablePanels);
    const targetAvailablePanelIds = new Set(
      targetPanels.map((panel) => panel.id),
    );

    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        if (inbound.xuiPanelId === null) {
          await this.inboundRepo.delete(inbound.id);
          continue;
        }

        const panelId = inbound.xuiPanelId;
        const isSelectedPanelInbound =
          !selectedPanelIds || selectedPanelIds.has(panelId);
        const isAvailableTargetPanelInbound = targetAvailablePanelIds.has(panelId);

        if (isSelectedPanelInbound && !isAvailableTargetPanelInbound) {
          continue;
        }

        if (inbound.xuiId > 0 && inbound.xuiPanelId) {
          await this.xuiService.deleteInbound(inbound.xuiPanelId, inbound.xuiId);
        }

        await this.inboundRepo.delete(inbound.id);
      }
    }

    await this.createSingletonInbounds(sub);

    for (const panel of targetPanels) {
      await this.createPanelInbounds(sub, domains, panel);
    }
  }

  private async createSingletonInbounds(sub: Subscription) {
    const inboundsConfig = sub.inboundsConfig || [];

    for (const config of inboundsConfig) {
      if (config.type !== 'custom') {
        continue;
      }

      const newInbound = this.inboundRepo.create({
        xuiId: 0,
        xuiPanelId: null,
        port: 0,
        relayPort: null,
        protocol: 'custom',
        remark: 'custom-link',
        link: config.link || '',
        subscription: sub,
      });
      await this.inboundRepo.save(newInbound);
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

    const usedOriginPorts = new Set<number>();
    const usedRelayPorts = new Set<number>();
    const serverAddress = panel.host || 'localhost';
    const flagEmoji = panel.geoFlag || '%F0%9F%92%AF';

    for (const config of inboundsConfig) {
      const type = config.type || '';

      if (type === 'hysteria2-udp') {
        await this.createHysteriaInbound(
          sub,
          domains,
          panel,
          config,
          usedRelayPorts,
          serverAddress,
          flagEmoji,
        );
        continue;
      }

      if (REALITY_TYPES.has(type) && !keys) {
        continue;
      }

      const uuid = uuidv4();
      const sni =
        config.sni === 'random'
          ? this.pickDomain(domains)
          : config.sni || this.pickDomain(domains);

      let requestedPort: number;
      if (config.port === 'random' || !config.port) {
        requestedPort = await this.getFreeOriginPort(0, usedOriginPorts, panel.id);
      } else {
        requestedPort =
          typeof config.port === 'string'
            ? parseInt(config.port, 10)
            : config.port;

        if (!Number.isFinite(requestedPort) || requestedPort <= 0) {
          requestedPort = await this.getFreeOriginPort(0, usedOriginPorts, panel.id);
        } else {
          requestedPort = await this.getFreeOriginPort(
            requestedPort,
            usedOriginPorts,
            panel.id,
          );
        }
      }

      let xuiConfig: XuiInboundRaw | null = null;

      switch (type) {
        case 'vless-tcp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityTcp({
            port: requestedPort,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-xhttp-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityXhttp({
            port: requestedPort,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-grpc-reality':
          xuiConfig = this.inboundBuilder.buildVlessRealityGrpc({
            port: requestedPort,
            uuid,
            sni,
            ...keys!,
          });
          break;
        case 'vless-ws':
          xuiConfig = this.inboundBuilder.buildVlessWs({
            port: requestedPort,
            uuid,
            sni,
          });
          break;
        case 'vmess-tcp':
          xuiConfig = this.inboundBuilder.buildVmessTcp({
            port: requestedPort,
            uuid,
          });
          break;
        case 'shadowsocks-tcp':
          xuiConfig = this.inboundBuilder.buildShadowsocksTcp({
            port: requestedPort,
            uuid,
          });
          break;
        case 'trojan-tcp-reality':
          xuiConfig = this.inboundBuilder.buildTrojanRealityTcp({
            port: requestedPort,
            uuid,
            sni,
            ...keys!,
          });
          break;
        default:
          this.logger.warn(`Неизвестный тип инбаунда: ${type}`);
          continue;
      }

      const createdInbound = await this.xuiService.addInbound(panel.id, xuiConfig);

      if (!createdInbound || !xuiConfig) {
        continue;
      }

      usedOriginPorts.add(createdInbound.port);
      const relayPort = await this.getFreeRelayPort(
        createdInbound.port,
        usedRelayPorts,
      );
      usedRelayPorts.add(relayPort);

      const effectiveConfig = { ...xuiConfig, port: createdInbound.port };
      const settings = JSON.parse(effectiveConfig.settings) as {
        clients?: Array<{ id?: string; password?: string }>;
      };
      const idOrPass =
        settings.clients?.[0]?.id || settings.clients?.[0]?.password || '';

      const fullLink = this.inboundBuilder.buildInboundLink(
        effectiveConfig,
        serverAddress,
        idOrPass,
        flagEmoji,
      );

      const newInbound = this.inboundRepo.create({
        xuiId: createdInbound.id,
        xuiPanelId: panel.id,
        port: createdInbound.port,
        relayPort,
        protocol: effectiveConfig.protocol,
        remark: effectiveConfig.remark,
        link: fullLink,
        subscription: sub,
      });
      await this.inboundRepo.save(newInbound);
    }
  }

  private async createHysteriaInbound(
    sub: Subscription,
    domains: Domain[],
    panel: XuiPanel,
    config: { sni?: string; port?: number | string },
    usedRelayPorts: Set<number>,
    fallbackHost: string,
    flagEmoji: string,
  ) {
    if (
      !panel.hysteriaEnabled ||
      !panel.hysteriaHost ||
      !panel.hysteriaPort ||
      !panel.hysteriaPassword ||
      !panel.hysteriaObfsPassword
    ) {
      this.logger.warn(
        `Hysteria2 для панели ${panel.name} не настроена, hysteria2-udp будет пропущен`,
      );
      return;
    }

    const relayPort = await this.getFreeRelayPort(
      panel.hysteriaPort,
      usedRelayPorts,
    );
    usedRelayPorts.add(relayPort);

    const hysteriaSni =
      config.sni && config.sni !== 'random'
        ? config.sni
        : panel.hysteriaSni ||
          panel.hysteriaHost ||
          fallbackHost ||
          this.pickDomain(domains);

    const link = this.inboundBuilder.buildHysteria2Link(
      panel.hysteriaHost || fallbackHost,
      hysteriaSni,
      `${flagEmoji}%20hysteria2-udp`,
      {
        port: panel.hysteriaPort,
        password: panel.hysteriaPassword,
        obfsPassword: panel.hysteriaObfsPassword,
      },
    );

    const newInbound = this.inboundRepo.create({
      xuiId: 0,
      xuiPanelId: panel.id,
      port: panel.hysteriaPort,
      relayPort,
      protocol: 'hysteria2',
      remark: 'hysteria2-udp',
      link,
      subscription: sub,
    });
    await this.inboundRepo.save(newInbound);
  }

  private pickDomain(list: Domain[]): string {
    return list[Math.floor(Math.random() * list.length)].name;
  }

  private async getFreeOriginPort(
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
      const port = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
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

  private async getFreeRelayPort(
    preferred: number,
    currentBatch: Set<number>,
  ): Promise<number> {
    if (preferred > 0 && !currentBatch.has(preferred)) {
      const existing = await this.inboundRepo.findOne({
        where: { relayPort: preferred },
      });
      if (!existing) {
        return preferred;
      }
    }

    while (true) {
      const port = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
      if (currentBatch.has(port)) {
        continue;
      }

      const existing = await this.inboundRepo.findOne({
        where: { relayPort: port },
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

    const needsPanels = this.hasPanelBoundConfigs(sub);
    const { availablePanels, failedPanels } = await this.getAvailablePanels();
    const selectedAvailablePanels = this.filterPanelsForSubscription(
      sub,
      availablePanels,
    );
    const selectedFailedPanels = this.filterPanelsForSubscription(sub, failedPanels);
    const totalSelectedPanels =
      selectedAvailablePanels.length + selectedFailedPanels.length;

    if (needsPanels && totalSelectedPanels === 0) {
      return {
        success: false,
        message: Array.isArray(sub.xuiPanelIds)
          ? 'Для подписки не выбрана ни одна панель 3x-ui'
          : 'Не добавлено ни одной панели 3x-ui',
      };
    }

    if (needsPanels && selectedAvailablePanels.length === 0) {
      return {
        success: false,
        message: Array.isArray(sub.xuiPanelIds)
          ? 'Не удалось войти ни в одну выбранную панель 3x-ui'
          : 'Не удалось войти ни в одну панель 3x-ui',
      };
    }

    const domains = needsPanels
      ? await this.domainRepo.find({ where: { isEnabled: true } })
      : [];
    if (needsPanels && domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return { success: false, message: 'Список доменов пуст!' };
    }

    await this.rotateSubscription(sub, domains, availablePanels);
    const tunnelSync = await this.tunnelsService.syncInstalledTunnels();

    this.logger.debug(`Ручная ротация подписки ${subscriptionId} завершена.`);
    return {
      success: true,
      message: this.buildResultMessage(
        selectedAvailablePanels,
        selectedFailedPanels,
        tunnelSync,
      ),
    };
  }
}
