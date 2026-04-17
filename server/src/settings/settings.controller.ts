import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { XuiPanelsService } from '../xui/xui-panels.service';
import { XuiService } from '../xui/xui.service';

interface PanelBody {
  name: string;
  url: string;
  login: string;
  password: string;
  isEnabled?: boolean;
}

@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private xuiService: XuiService,
    private xuiPanelsService: XuiPanelsService,
  ) {}

  @Get('panels')
  findAllPanels() {
    return this.xuiPanelsService.findAll();
  }

  @Post('panels/check')
  async checkPanelConnection(
    @Body() body: { url: string; login: string; password: string },
  ) {
    const success = await this.xuiService.checkConnection(
      body.url,
      body.login,
      body.password,
    );
    return { success };
  }

  @Post('panels')
  createPanel(@Body() body: PanelBody) {
    return this.xuiPanelsService.create(body);
  }

  @Put('panels/:id')
  updatePanel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<PanelBody>,
  ) {
    return this.xuiPanelsService.update(id, body);
  }

  @Delete('panels/:id')
  removePanel(@Param('id', ParseIntPipe) id: number) {
    return this.xuiPanelsService.remove(id);
  }

  @Get()
  async findAll() {
    const settings = await this.settingsRepo.find();
    return settings.reduce(
      (acc, curr) => ({ ...acc, [curr.key]: curr.value }),
      {},
    );
  }

  @Post('check')
  async checkConnection(
    @Body()
    body: {
      xui_url?: string;
      xui_login?: string;
      xui_password?: string;
      url?: string;
      login?: string;
      password?: string;
    },
  ) {
    const success = await this.xuiService.checkConnection(
      body.url || body.xui_url || '',
      body.login || body.xui_login || '',
      body.password || body.xui_password || '',
    );
    return { success };
  }

  @Post()
  async update(@Body() settings: Record<string, string>) {
    const blockedKeys = new Set([
      'xui_url',
      'xui_login',
      'xui_password',
      'xui_host',
      'xui_ip',
      'xui_geo_country',
      'xui_geo_flag',
    ]);

    for (const [key, value] of Object.entries(settings)) {
      if (blockedKeys.has(key)) {
        continue;
      }

      await this.settingsRepo.save({ key, value });
    }

    this.logger.log('Settings saved to database');
    return { success: true };
  }
}
