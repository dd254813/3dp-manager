import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Res,
  Logger,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

interface LoginDto {
  login: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Throttle({
    default: { limit: 5, ttl: 60000 },
  })
  @Post('login')
  async login(
    @Body() req: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Login request received for user: ${req.login}`);
    const user = await this.authService.validateUser(req.login, req.password);
    if (!user) {
      this.logger.warn(`Login failed for user: ${req.login}`);
      throw new HttpException(
        'Неверный логин или пароль',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const { access_token } = this.authService.login(user as { login: string });

    // Устанавливаем httpOnly cookie
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.logger.debug(
      `Login succeeded for user: ${req.login}. Setting auth cookie (secure=${isProduction}, sameSite=lax, maxAgeMs=86400000)`,
    );
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: isProduction, // HTTPS только в production
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
      path: '/',
    });

    this.logger.debug(`Login response prepared for user: ${req.login}`);
    return { access_token };
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const hadCookie = Boolean(
      (req.cookies as Record<string, unknown> | undefined)?.access_token,
    );
    this.logger.debug(`Logout request received. Cookie present: ${hadCookie}`);

    // Очищаем httpOnly cookie
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    this.logger.debug(
      `Auth cookie cleared (secure=${isProduction}, sameSite=lax, path=/)`,
    );

    return { success: true };
  }

  @Post('change-password')
  async changePassword(@Body('password') password: string) {
    await this.authService.changePassword(password);
    return { success: true };
  }

  @Post('update-profile')
  async updateProfile(@Body() body: { login: string; password?: string }) {
    await this.authService.updateAdminProfile(body.login, body.password);
    return { success: true };
  }
}
