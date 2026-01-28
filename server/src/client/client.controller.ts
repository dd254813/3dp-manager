import { Controller, Get, Param, HttpException, HttpStatus, Res, Req, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response, Request } from 'express';
import * as QRCode from 'qrcode';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Public } from '../auth/public.decorator';

@Controller() // Убираем 'client', так как путь зададим явно
export class ClientController {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }

  @Public()
  @Get('bus/:uuid') // Тот самый путь /bus/UUID
  async getSubscription(
    @Param('uuid') uuid: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    // 1. Ищем подписку
    const sub = await this.subRepo.findOne({
      where: { uuid },
      relations: ['inbounds']
    });

    if (!sub || !sub.isEnabled) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }

    // 2. Генерируем список ссылок (Config)
    const links = sub.inbounds
      ?.map(i => i.link)
      .filter(l => l && l.length > 0) || [];

    // Формируем Base64 строку (это и есть подписка для клиента)
    const plainTextList = links.join('\n');
    const base64Config = Buffer.from(plainTextList).toString('base64');

    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/.test(userAgent);

    if (!isBrowser) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(base64Config);
    } else {

      const currentUrl = `${req.protocol}://${req.get('host')}/bus/${uuid}`;

      const cacheKey = `qr_${uuid}`;

      let qrDataUrl = await this.cacheManager.get<string>(cacheKey);

      if (!qrDataUrl) {
        qrDataUrl = await QRCode.toDataURL(currentUrl, { width: 300, margin: 2 });

        await this.cacheManager.set(cacheKey, qrDataUrl, 86400000);
      } else {
        console.log(`Взяли QR из кэша для ${uuid}`);
      }

      // HTML шаблон
      const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${sub.name} | 3DP-MANAGER</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
            h2 { margin-top: 0; color: #333; }
            .qr-box { background: #fff; padding: 10px; border: 1px solid #eee; border-radius: 8px; display: inline-block; margin: 20px 0; }
            .link-box { background: #f5f5f5; padding: 10px; border-radius: 6px; font-family: monospace; word-break: break-all; font-size: 12px; color: #666; margin-bottom: 20px; border: 1px solid #e0e0e0; }
            button { background-color: #1976d2; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; transition: background 0.2s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
            button:hover { background-color: #1565c0; }
            button:active { transform: scale(0.98); }
            .note { margin-top: 20px; font-size: 12px; color: #999; }
            
            #subscription-links { display: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Ваша подписка</h2>
            <p style="color: #666;">Отсканируйте QR-код в приложении Happ, v2RayTun или Streisand</p>
            
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>

            <div class="link-box" id="link-text">${currentUrl}</div>

            <button onclick="copyLink()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>
              Копировать ссылку
            </button>

            <div class="note">Для автоматического обновления конфигов используйте эту ссылку</div>
            
          </div>
          <textarea id="subscription-links">${base64Config}</textarea>

          <script>
            function copyLink() {
              const link = document.getElementById('link-text').innerText;
              navigator.clipboard.writeText(link).then(() => {
                const btn = document.querySelector('button');
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Скопировано!';
                btn.style.backgroundColor = '#2e7d32';
                setTimeout(() => {
                  btn.innerHTML = originalText;
                  btn.style.backgroundColor = '#1976d2';
                }, 2000);
              });
            }
          </script>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  }
}