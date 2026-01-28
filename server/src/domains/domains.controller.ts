import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { DomainsService } from './domains.service';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) { }

  @Post()
  create(@Body() body: { name: string }) {
    return this.domainsService.create(body);
  }

  // Загрузка списка (массива строк)
  @Post('upload')
  uploadMany(@Body() body: { domains: string[] }) {
    return this.domainsService.createMany(body.domains);
  }

  @Get()
  findAll(
    @Query('page') page: number,
    @Query('limit') limit: number
  ) {
    // Если параметры не передали, ставим дефолтные: стр 1, лимит 10
    const pageNum = page ? +page : 1;
    const limitNum = limit ? +limit : 10;

    return this.domainsService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domainsService.findOne(+id);
  }

  // ВАЖНО: @Delete('all') должен идти ПЕРЕД @Delete(':id')
  @Delete('all')
  removeAll() {
    return this.domainsService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domainsService.remove(+id);
  }
}