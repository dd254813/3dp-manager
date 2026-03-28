import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
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

    // Support token from query parameter (for SSE connections)
    const tokenFromQuery = request.query.token as string | undefined;
    if (tokenFromQuery && !request.headers.authorization) {
      this.logger.debug(
        `Token found in query parameter, adding to Authorization header`,
      );
      request.headers.authorization = `Bearer ${tokenFromQuery}`;
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
