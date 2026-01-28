import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Inbound } from '../inbounds/entities/inbound.entity';
import { XuiService } from '../xui/xui.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(Inbound)
    private inboundRepo: Repository<Inbound>,
    private xuiService: XuiService,
  ) {}

  findAll() {
    return this.subRepo.find({ relations: ['inbounds'], order: { createdAt: 'DESC' } });
  }

  async create(name: string) {
    const sub = this.subRepo.create({
      name,
      uuid: uuidv4(),
    });
    return this.subRepo.save(sub);
  }

  async remove(id: string) {
    const sub = await this.subRepo.findOne({ where: { id }, relations: ['inbounds'] });
    if (!sub) return;

    if (sub.inbounds) {
      for (const inbound of sub.inbounds) {
        await this.xuiService.deleteInbound(inbound.xuiId);
      }
    }

    return this.subRepo.remove(sub);
  }
}