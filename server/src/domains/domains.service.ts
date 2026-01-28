import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from './entities/domain.entity';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private repo: Repository<Domain>,
  ) { }

  // Создать один домен
  async create(createDomainDto: { name: string }) {
    // Простейшая проверка на дубликат (можно и через try-catch)
    const exists = await this.repo.findOne({ where: { name: createDomainDto.name } });
    if (exists) return exists;

    const domain = this.repo.create(createDomainDto);
    return this.repo.save(domain);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [result, total] = await this.repo.findAndCount({
      take: limit, // Сколько взять (10)
      skip: skip,  // Сколько пропустить
      order: { id: 'DESC' }, // Сортируем: новые сверху
    });

    return {
      data: result,
      total: total,
    };
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  // Удалить один
  remove(id: number) {
    return this.repo.delete(id);
  }

  // === СПЕЦИАЛЬНЫЕ МЕТОДЫ ===

  // 1. Удалить вообще всё (для кнопки "Удалить все")
  async removeAll() {
    await this.repo.clear(); // TRUNCATE table
    return { success: true };
  }

  // 2. Массовая загрузка из файла
  async createMany(names: string[]) {
    if (!names || names.length === 0) return { count: 0 };

    // Убираем пробелы и пустые строки
    const cleanNames = names
      .map(n => n.trim())
      .filter(n => n.length > 0);

    // Получаем текущие домены, чтобы не вставлять дубли
    const existing = await this.repo.find();
    const existingSet = new Set(existing.map(d => d.name));

    // Оставляем только новые
    const uniqueNewNames = [...new Set(cleanNames)] // убираем дубли внутри самого файла
      .filter(name => !existingSet.has(name));      // убираем те, что уже есть в БД

    if (uniqueNewNames.length === 0) return { count: 0 };

    // Создаем и сохраняем
    const entities = uniqueNewNames.map(name => this.repo.create({ name }));
    await this.repo.save(entities);

    return { count: entities.length };
  }
}