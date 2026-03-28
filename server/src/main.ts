import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { RequestMethod, Logger, LogLevel } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './client/client.exception-filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Настройка уровня логирования из переменной окружения
  const configuredLevel = configService.get<string>('LOG_LEVEL', 'error');
  const logLevels: LogLevel[] =
    configuredLevel === 'debug'
      ? ['error', 'warn', 'log', 'debug']
      : configuredLevel === 'verbose'
        ? ['error', 'warn', 'log', 'debug', 'verbose']
        : ['error', 'warn', 'log'];

  app.useLogger(logLevels);

  app.set('trust proxy', 1);

  const authService = app.get(AuthService);
  await authService.seedAdmin();

  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'bus/:uuid', method: RequestMethod.GET },
      { path: 'bus/:uuid/:tunnelId', method: RequestMethod.GET },
    ],
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Application started on port ${port}`);
}
void bootstrap();
