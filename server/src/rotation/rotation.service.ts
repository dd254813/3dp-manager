import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Setting } from '../settings/entities/setting.entity';

import { XuiService } from '../xui/xui.service';
import { InboundBuilderService } from '../inbounds/inbound-builder.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Inbound) private inboundRepo: Repository<Inbound>,
    @InjectRepository(Domain) private domainRepo: Repository<Domain>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    private xuiService: XuiService,
    private inboundBuilder: InboundBuilderService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTicker() {
    const intervalSetting = await this.settingRepo.findOne({ where: { key: 'rotation_interval' } });
    const intervalMinutes = intervalSetting ? parseInt(intervalSetting.value, 10) : 30;

    const lastRunSetting = await this.settingRepo.findOne({ where: { key: 'last_rotation_timestamp' } });
    const lastRun = lastRunSetting ? parseInt(lastRunSetting.value, 10) : 0;

    const now = Date.now();
    const diffMinutes = (now - lastRun) / 1000 / 60;

    if (diffMinutes < intervalMinutes) {
      return;
    }

    await this.performRotation();

    await this.saveSetting('last_rotation_timestamp', now.toString());
  }

  private async saveSetting(key: string, value: string) {
    let s = await this.settingRepo.findOne({ where: { key } });
    if (!s) s = this.settingRepo.create({ key });
    s.value = value;
    await this.settingRepo.save(s);
  }

  private async performRotation() {
    this.logger.log('Запуск плановой ротации...');

    const isLoginSuccess = await this.xuiService.login();
    if (!isLoginSuccess) {
      this.logger.error('Отмена ротации: Не удалось войти в панель 3x-ui');
      return;
    }

    const subscriptions = await this.subRepo.find({ where: { isEnabled: true }, relations: ['inbounds'] });
    if (subscriptions.length === 0) return;

    const domains = await this.domainRepo.find({ where: { isEnabled: true } });
    if (domains.length === 0) {
      this.logger.warn('Список доменов пуст! Ротация невозможна.');
      return;
    }

    for (const sub of subscriptions) {
      await this.rotateSubscription(sub, domains);
    }

    this.logger.log('Ротация завершена.');
  }

  private async rotateSubscription(sub: Subscription, domains: Domain[]) {
    this.logger.log(`Ротация для подписки: ${sub.name} (${sub.uuid})`);

    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        await this.xuiService.deleteInbound(inbound.xuiId);
        await this.inboundRepo.delete(inbound.id);
      }
    }

    const keys = await this.xuiService.getNewX25519Cert();
    if (!keys) {
      this.logger.error("Не удалось получить Reality ключи, пропускаем подписку");
      return;
    }

    const usedPorts = new Set<number>();

    const tasks = [
      () => this.inboundBuilder.buildVlessRealityTcp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }), // Port 8443 pref
      () => this.inboundBuilder.buildVlessRealityXhttp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }), // Port 443 pref
      () => this.inboundBuilder.buildVlessRealityGrpc({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }),
      () => this.inboundBuilder.buildVlessWs({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains) }),
      () => this.inboundBuilder.buildVlessRealityTcp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }),
      () => this.inboundBuilder.buildVlessRealityTcp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }),
      () => this.inboundBuilder.buildVlessRealityTcp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }),
      () => this.inboundBuilder.buildVmessTcp({ port: 0, uuid: uuidv4() }),
      () => this.inboundBuilder.buildShadowsocksTcp({ port: 0, uuid: uuidv4() }),
      () => this.inboundBuilder.buildTrojanRealityTcp({ port: 0, uuid: uuidv4(), domain: this.pickDomain(domains), ...keys }),
    ];

    const host = await this.settingRepo.findOne({ where: { key: 'xui_host' } });
    const serverAddress = host?.value || 'localhost';

    for (const [index, task] of tasks.entries()) {
      let config = task();

      let port = 0;
      if (index === 0) port = await this.getFreePort(8443, usedPorts);
      else if (index === 1) port = await this.getFreePort(443, usedPorts);
      else port = await this.getFreePort(0, usedPorts);

      config.port = port;
      usedPorts.add(port);

      const xuiId = await this.xuiService.addInbound(config);

      if (xuiId) {
        const remarkParts = config.remark.split('-');
        let domainForLink = 'unknown';
        try {
          const ss = JSON.parse(config.streamSettings || '{}');
          if (ss.realitySettings?.serverNames?.[0]) domainForLink = ss.realitySettings.serverNames[0];
          else if (ss.wsSettings?.headers?.Host) domainForLink = ss.wsSettings.headers.Host;
          else if (ss.tcpSettings?.header?.request?.headers?.Host?.[0]) domainForLink = ss.tcpSettings.header.request.headers.Host[0];
        } catch (e) { }
        const idOrPass = config.settings ? JSON.parse(config.settings).clients?.[0]?.id || JSON.parse(config.settings).clients?.[0]?.password : "";
        const fullLink = this.inboundBuilder.buildInboundLink(config, serverAddress, idOrPass);

        const newInbound = this.inboundRepo.create({
          xuiId: xuiId,
          port: port,
          protocol: config.protocol,
          remark: config.remark,
          link: fullLink,
          subscription: sub
        });
        await this.inboundRepo.save(newInbound);
      }
    }
  }
  private pickDomain(list: Domain[]): string {
    return list[Math.floor(Math.random() * list.length)].name;
  }

  private async getFreePort(preferred: number, currentBatch: Set<number>): Promise<number> {
    if (preferred > 0 && !currentBatch.has(preferred)) {
      const exists = await this.inboundRepo.findOne({ where: { port: preferred } });
      if (!exists) return preferred;
    }

    while (true) {
      const p = Math.floor(Math.random() * (60000 - 10000)) + 10000;
      if (currentBatch.has(p)) continue;

      const exists = await this.inboundRepo.findOne({ where: { port: p } });
      if (!exists) return p;
    }
  }
}