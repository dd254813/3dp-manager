import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, IsNull, Not } from 'typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { SshService } from './ssh.service';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { XuiPanel } from '../xui/entities/xui-panel.entity';

interface TunnelWithSecrets extends Tunnel {
  password?: string;
  privateKey?: string;
}

interface TunnelSyncResult {
  syncedCount: number;
  totalCount: number;
  failedNames: string[];
}

@Injectable()
export class TunnelsService {
  private readonly logger = new Logger(TunnelsService.name);

  constructor(
    @InjectRepository(Tunnel) private tunnelRepo: Repository<Tunnel>,
    @InjectRepository(Inbound) private inboundRepo: Repository<Inbound>,
    @InjectRepository(XuiPanel) private panelRepo: Repository<XuiPanel>,
    private sshService: SshService,
  ) {}

  async create(createTunnelDto: DeepPartial<Tunnel>) {
    const tunnel = this.tunnelRepo.create(createTunnelDto);
    return this.tunnelRepo.save(tunnel);
  }

  async findAll() {
    return this.tunnelRepo.find();
  }

  async remove(id: number) {
    return this.tunnelRepo.delete(id);
  }

  async installScript(id: number) {
    const tunnel = await this.getTunnelWithSecrets(id);

    if (!tunnel) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }

    this.logger.debug(`Начинаем установку редиректа на ${tunnel.ip}`);

    try {
      const output = await this.installOnTunnel(tunnel);
      return { success: true, output };
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Ошибка SSH: ${error.message}`);
      throw new HttpException(
        `Ошибка установки: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async syncInstalledTunnels(): Promise<TunnelSyncResult> {
    const tunnels = await this.findInstalledWithSecrets();

    if (tunnels.length === 0) {
      return { syncedCount: 0, totalCount: 0, failedNames: [] };
    }

    const forwardRules = await this.buildForwardRules();
    let syncedCount = 0;
    const failedNames: string[] = [];

    for (const tunnel of tunnels) {
      try {
        await this.executeInstallCommand(tunnel, forwardRules);
        syncedCount++;
      } catch (error) {
        failedNames.push(tunnel.name);
        this.logger.error(
          `Не удалось пересинхронизировать relay ${tunnel.name}: ${(error as Error).message}`,
        );
      }
    }

    return {
      syncedCount,
      totalCount: tunnels.length,
      failedNames,
    };
  }

  private async installOnTunnel(tunnel: TunnelWithSecrets) {
    const forwardRules = await this.buildForwardRules();
    const output = await this.executeInstallCommand(tunnel, forwardRules);

    tunnel.isInstalled = true;
    await this.tunnelRepo.save(tunnel);

    this.logger.debug(`Скрипт выполнен успешно на ${tunnel.name}:\n${output}`);
    return output;
  }

  private async executeInstallCommand(
    tunnel: TunnelWithSecrets,
    forwardRules: string,
  ) {
    const command = this.buildInstallCommand(forwardRules);

    return this.sshService.executeCommand(
      {
        host: tunnel.ip,
        port: tunnel.sshPort,
        username: tunnel.username,
        password: tunnel.password,
        privateKey: tunnel.privateKey,
      },
      command,
    );
  }

  private buildInstallCommand(forwardRules: string) {
    const sourceUrl =
      'https://raw.githubusercontent.com/dd254813/3dp-manager/main/forwarding_install.sh';

    return `sudo FORWARD_RULES="${forwardRules}" bash -c "$(curl -sSL ${sourceUrl})"`;
  }

  private async buildForwardRules() {
    const [inbounds, panels] = await Promise.all([
      this.inboundRepo.find({
        where: {
          xuiPanelId: Not(IsNull()),
          relayPort: Not(IsNull()),
        },
        order: { relayPort: 'ASC' },
      }),
      this.panelRepo.find(),
    ]);

    const panelMap = new Map<number, XuiPanel>(
      panels.map((panel) => [panel.id, panel]),
    );
    const seen = new Set<string>();
    const rules: string[] = [];

    for (const inbound of inbounds) {
      if (
        !inbound.xuiPanelId ||
        !inbound.relayPort ||
        inbound.relayPort <= 0 ||
        inbound.port <= 0
      ) {
        continue;
      }

      const panel = panelMap.get(inbound.xuiPanelId);
      if (!panel?.ip) {
        this.logger.warn(
          `Пропускаем relay rule для панели ${inbound.xuiPanelId}: не найден IP origin-сервера`,
        );
        continue;
      }

      const protocol = inbound.protocol === 'hysteria2' ? 'udp' : 'tcp';
      const ruleKey = `${protocol}:${inbound.relayPort}`;

      if (seen.has(ruleKey)) {
        this.logger.warn(
          `Дублирующий relayPort ${inbound.relayPort}/${protocol} пропущен`,
        );
        continue;
      }

      rules.push(`${protocol}:${inbound.relayPort}:${panel.ip}:${inbound.port}`);
      seen.add(ruleKey);
    }

    return rules.join(',');
  }

  private async getTunnelWithSecrets(id: number) {
    return this.tunnelRepo
      .createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .addSelect('tunnel.privateKey')
      .where('tunnel.id = :id', { id })
      .getOne();
  }

  private async findInstalledWithSecrets() {
    return this.tunnelRepo
      .createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .addSelect('tunnel.privateKey')
      .where('tunnel.isInstalled = :isInstalled', { isInstalled: true })
      .getMany();
  }
}
