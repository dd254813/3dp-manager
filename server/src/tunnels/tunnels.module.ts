import { Module } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { TunnelsController } from './tunnels.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tunnel } from './entities/tunnel.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { XuiPanel } from '../xui/entities/xui-panel.entity';
import { SshService } from './ssh.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tunnel, Inbound, XuiPanel])],
  controllers: [TunnelsController],
  providers: [TunnelsService, SshService],
  exports: [TunnelsService],
})
export class TunnelsModule {}
