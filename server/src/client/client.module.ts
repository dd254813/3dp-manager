import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientController } from './client.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription]), CacheModule.register()],
  controllers: [ClientController],
})
export class ClientModule {}