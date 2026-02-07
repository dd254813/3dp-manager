import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { SshService } from './ssh.service';
import { Setting } from '../settings/entities/setting.entity';

@Injectable()
export class TunnelsService {
  private readonly logger = new Logger(TunnelsService.name);

  constructor(
    @InjectRepository(Tunnel) private tunnelRepo: Repository<Tunnel>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    private sshService: SshService,
  ) {}

  async create(createTunnelDto: any) {
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
    const tunnel = await this.tunnelRepo.createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .where('tunnel.id = :id', { id })
      .getOne();

    if (!tunnel) throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);

    const hostSetting = await this.settingRepo.findOne({ where: { key: 'xui_ip' } });
    
    if (!hostSetting || !hostSetting.value) {
      throw new HttpException(
        'В настройках (Settings) не сохранен Host/IP основного сервера (xui_host). Сохраните настройки подключения к 3x-ui заново.', 
        HttpStatus.BAD_REQUEST
      );
    }
    const mainServerIp = hostSetting.value;

    this.logger.log(`Начинаем установку редиректа на ${tunnel.ip} -> ${mainServerIp}`);

    const command = `export ORIGIN_IP="${mainServerIp}" && bash <(curl -fsSL https://raw.githubusercontent.com/denpiligrim/3dp-manager/main/forwarding_install.sh)`;

    try {
      const output = await this.sshService.executeCommand({
        host: tunnel.ip,
        port: tunnel.sshPort,
        username: tunnel.username,
        password: tunnel.password
      }, command);

      this.logger.log(`Скрипт выполнен успешно:\n${output}`);
      
      tunnel.isInstalled = true;
      await this.tunnelRepo.save(tunnel);
      
      return { success: true, output };
    } catch (e) {
      this.logger.error(`Ошибка SSH: ${e.message}`);
      throw new HttpException(`Ошибка установки: ${e.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}