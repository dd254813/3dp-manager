import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inbound } from './entities/inbound.entity';
import { InboundBuilderService } from './inbound-builder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Inbound])],
  providers: [InboundBuilderService],
  exports: [InboundBuilderService],
})
export class InboundsModule {}
