import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Setting } from '../settings/entities/setting.entity';
import { XuiPanel } from './entities/xui-panel.entity';
import { XuiPanelsService } from './xui-panels.service';
import { XuiService } from './xui.service';

@Module({
  imports: [TypeOrmModule.forFeature([XuiPanel, Setting, Inbound])],
  providers: [XuiService, XuiPanelsService],
  exports: [XuiService, XuiPanelsService],
})
export class XuiModule {}
