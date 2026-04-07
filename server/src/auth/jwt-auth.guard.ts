import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

type RequestWithCookies = Request & {
  cookies?: unknown;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const cookies: Record<string, unknown> =
      request.cookies && typeof request.cookies === 'object'
        ? (request.cookies as Record<string, unknown>)
        : {};
    this.logger.debug(
      `canActivate called for: ${request.url} ${request.method}`,
    );

    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    this.logger.debug(`isPublic: ${isPublic}`);

    if (isPublic) {
      this.logger.debug(`Skipping public route`);
      return true;
    }

    // Поддержка токена из cookie (httpOnly)
    const tokenFromCookieValue = cookies.access_token;
    const tokenFromCookie =
      typeof tokenFromCookieValue === 'string'
        ? tokenFromCookieValue
        : undefined;
    if (tokenFromCookie && !request.headers.authorization) {
      this.logger.debug(
        `Token found in cookie, adding to Authorization header`,
      );
      request.headers.authorization = `Bearer ${tokenFromCookie}`;
    } else if (tokenFromCookie) {
      this.logger.debug(
        `Token found in cookie, but Authorization header already exists`,
      );
    }

    // Support token from query parameter (for SSE connections)
    const tokenFromQuery = request.query.token as string | undefined;
    if (tokenFromQuery && !request.headers.authorization) {
      this.logger.debug(
        `Token found in query parameter, adding to Authorization header`,
      );
      request.headers.authorization = `Bearer ${tokenFromQuery}`;
    } else if (tokenFromQuery) {
      this.logger.debug(
        `Token found in query parameter, but Authorization header already exists`,
      );
    } else if (!request.headers.authorization) {
      this.logger.debug(
        `No token found in Authorization header, cookie, or query`,
      );
    }

    this.logger.debug(`Calling super.canActivate()`);
    const result = super.canActivate(context);
    this.logger.debug(
      `canActivate result: ${typeof result === 'boolean' ? result : 'PENDING'}`,
    );
    return result;
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    _context?: unknown,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      const errMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : err
              ? JSON.stringify(err)
              : 'null';
      this.logger.warn(`handleRequest: ${errMessage || 'Unauthorized'}`);
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
