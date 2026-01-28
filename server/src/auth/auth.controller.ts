import { Controller, Post, Body, Request, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() req) {
    const user = await this.authService.validateUser(req.login, req.password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return this.authService.login(user);
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