import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { Domain } from './entities/domain.entity';
import { DomainScannerService } from './domain-scanner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Domain])],
  controllers: [DomainsController],
  providers: [DomainsService, DomainScannerService],
  exports: [DomainsService],
})
export class DomainsModule {}
