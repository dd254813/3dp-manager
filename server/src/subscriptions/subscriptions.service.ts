import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { XuiService } from '../xui/xui.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    private xuiService: XuiService,
  ) {}

  findAll() {
    return this.subRepo.find({ relations: ['inbounds'], order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateSubscriptionDto) {
    const sub = this.subRepo.create({
      name: dto.name,
      uuid: uuidv4(),
      inboundsConfig: dto.inboundsConfig || [],
    });
    
    return this.subRepo.save(sub);
  }

  async update(id: string, dto: CreateSubscriptionDto) {
    const sub = await this.subRepo.findOne({ 
      where: { id }, 
      relations: ['inbounds'] 
    });

    if (!sub) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    sub.name = dto.name;
    
    if (dto.inboundsConfig) {
      sub.inboundsConfig = dto.inboundsConfig;
    }

    return this.subRepo.save(sub);
  }

  async remove(id: string) {
    const sub = await this.subRepo.findOne({ where: { id }, relations: ['inbounds'] });
    if (!sub) return;

    if (sub.inbounds && sub.inbounds.length > 0) {
      for (const inbound of sub.inbounds) {
        await this.xuiService.deleteInbound(inbound.xuiId);
      }
    }

    return this.subRepo.remove(sub);
  }
}