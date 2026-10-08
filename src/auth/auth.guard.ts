import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.path.replace(/^\/api/, '');
    if (path === '/auth/login' && request.method === 'POST') return true;
    // The storefront consumes catalog and checkout endpoints without a panel session.
    if (
      (request.method === 'GET' && [
        '/products', '/pizzas', '/categories', '/optionals', '/neighborhoods',
        '/payment-methods', '/store-settings', '/pizzeria-settings', '/orders/tracking',
      ].includes(path)) ||
      (request.method === 'POST' && ['/orders', '/orders/quote'].includes(path))
    ) return true;
    const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const user = bearer ? this.auth.verifyToken(bearer) : null;
    if (!user) throw new UnauthorizedException('Faça login para continuar.');
    request.user = user;
    return true;
  }
}
