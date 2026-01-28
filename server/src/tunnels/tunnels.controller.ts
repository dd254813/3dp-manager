import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { Tunnel } from './entities/tunnel.entity';

@Controller('tunnels')
export class TunnelsController {
  constructor(private readonly tunnelsService: TunnelsService) {}

  @Post()
  create(@Body() createTunnelDto: Tunnel) {
    return this.tunnelsService.create(createTunnelDto);
  }

  @Get()
  findAll() {
    return this.tunnelsService.findAll();
  }

  @Post(':id/install')
  install(@Param('id') id: string) {
    return this.tunnelsService.installScript(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tunnelsService.remove(+id);
  }
}