import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XuiService } from './xui.service';
import { Setting } from '../settings/entities/setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [XuiService],
  exports: [XuiService],
})
export class XuiModule {}