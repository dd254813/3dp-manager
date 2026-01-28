import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import * as dns from 'dns/promises';

@Controller('settings')
export class SettingsController {
  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
  ) {}

  @Get()
  async findAll() {
    const settings = await this.settingsRepo.find();
    return settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
  }

  @Post()
  async update(@Body() settings: Record<string, string>) {    
    if (settings.xui_url) {
      try {
        const parsed = new URL(settings.xui_url);      
        settings['xui_host'] = parsed.hostname;
        
        const { address } = await dns.lookup(parsed.hostname);
          
        settings['xui_ip'] = address;
        console.log(`Extracted host: ${parsed.hostname} from ${settings.xui_url}`);
      } catch (e) {
        console.warn(`Не удалось извлечь хост из URL: ${settings.xui_url}`);
      }
    }
    for (const [key, value] of Object.entries(settings)) {
      await this.settingsRepo.save({ key, value });
    }
    return { success: true };
  }
}