import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const authService = app.get(AuthService);
  await authService.seedAdmin();
  
  app.enableCors();
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'bus/:uuid', method: RequestMethod.GET }]
  });
  
  await app.listen(3000);
}
bootstrap();