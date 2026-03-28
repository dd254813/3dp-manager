import { Module } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { TunnelsController } from './tunnels.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { Setting } from '../settings/entities/setting.entity';
import { SshService } from './ssh.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tunnel, Setting])],
  controllers: [TunnelsController],
  providers: [TunnelsService, SshService],
})
export class TunnelsModule {}
