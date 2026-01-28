import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { RotationService } from './rotation.service';
import { XuiModule } from '../xui/xui.module';
import { InboundsModule } from '../inbounds/inbounds.module';

import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Setting } from '../settings/entities/setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Inbound, Domain, Setting]),
    ScheduleModule.forRoot(),
    XuiModule,
    InboundsModule,
  ],
  providers: [RotationService],
})
export class RotationModule {}