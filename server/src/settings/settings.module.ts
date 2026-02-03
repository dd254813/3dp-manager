import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { Setting } from './entities/setting.entity';
import { XuiModule } from 'src/xui/xui.module';

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), XuiModule],
  controllers: [SettingsController],
})
export class SettingsModule {}