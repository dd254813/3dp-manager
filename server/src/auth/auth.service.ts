import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Setting } from '../settings/entities/setting.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private jwtService: JwtService,
  ) {}

  async validateUser(login: string, pass: string): Promise<any> {
    this.logger.log(`Попытка входа с логином: ${login}`);

    const dbLogin = await this.settingsRepo.findOne({ where: { key: 'admin_login' } });
    const dbPass = await this.settingsRepo.findOne({ where: { key: 'admin_password' } });

    if (!dbLogin) {
      this.logger.error('Пользователь admin_login не найден в базе данных!');
      return null;
    }

    if (!dbPass) {
      this.logger.error('Пароль admin_password не найден в базе данных!');
      return null;
    }

    this.logger.log(`Пользователь найден, проверяем хеш пароля...`);
    
    const isMatch = await bcrypt.compare(pass, dbPass.value);
    
    if (isMatch) {
      this.logger.log('Пароль верный!');
      return { login: dbLogin.value };
    } else {
      this.logger.warn('Пароль неверный.');
      return null;
    }
  }

  async login(user: any) {
    const payload = { username: user.login };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async changePassword(newPass: string) {
    const hash = await bcrypt.hash(newPass, 10);
    let setting = await this.settingsRepo.findOne({ where: { key: 'admin_password' } });
    if (!setting) {
      setting = this.settingsRepo.create({ key: 'admin_password' });
    }
    setting.value = hash;
    await this.settingsRepo.save(setting);
    this.logger.log('Пароль администратора изменен.');
  }

  async updateAdminProfile(login: string, password?: string) {
    let loginSetting = await this.settingsRepo.findOne({ where: { key: 'admin_login' } });
    if (!loginSetting) loginSetting = this.settingsRepo.create({ key: 'admin_login' });
    
    loginSetting.value = login;
    await this.settingsRepo.save(loginSetting);

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      let passSetting = await this.settingsRepo.findOne({ where: { key: 'admin_password' } });
      if (!passSetting) passSetting = this.settingsRepo.create({ key: 'admin_password' });
      
      passSetting.value = hash;
      await this.settingsRepo.save(passSetting);
    }
    
    this.logger.log(`Профиль администратора обновлен. Новый логин: ${login}`);
  }

  async seedAdmin() {
    const login = await this.settingsRepo.findOne({ where: { key: 'admin_login' } });
    
    if (!login) {
      this.logger.log('Инициализация администратора (admin / admin)...');
      
      const loginSetting = this.settingsRepo.create({ key: 'admin_login', value: 'admin' });
      await this.settingsRepo.save(loginSetting);

      const hash = await bcrypt.hash('admin', 10);
      const passSetting = this.settingsRepo.create({ key: 'admin_password', value: hash });
      await this.settingsRepo.save(passSetting);
      
      this.logger.log('Администратор успешно создан.');
    } else {
      this.logger.log('Администратор уже существует в базе.');
    }
  }
}