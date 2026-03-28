import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingHttpHeaders } from 'http';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_SECRET') || 'SECRET_KEY_CHANGE_ME';
    super({
      jwtFromRequest: (req: { headers?: IncomingHttpHeaders }) => {
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    const maskedSecret =
      secret.length > 8
        ? `${secret.substring(0, 4)}${'*'.repeat(secret.length - 8)}${secret.substring(secret.length - 4)}`
        : '****';
    console.log(`[JwtStrategy] Initialized with secret: ${maskedSecret}`);
  }

  validate(payload: { sub: string; username: string }) {
    const maskedUsername =
      payload.username.length > 6
        ? `${payload.username.substring(0, 3)}***${payload.username.substring(payload.username.length - 2)}`
        : '***';
    console.log(`[JwtStrategy] Validating token for user: ${maskedUsername}`);
    return { userId: payload.sub, username: payload.username };
  }
}
