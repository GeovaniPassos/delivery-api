import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { UsersService } from '../users/users.service';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly config: ConfigService) {}

  async ensureSupportUser() {
    const email = this.config.get<string>('SUPPORT_EMAIL');
    const password = this.config.get<string>('SUPPORT_PASSWORD');
    if (!email || !password) return;
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    await this.users.ensureSupportUser(
      this.config.get<string>('SUPPORT_NAME') || 'Suporte',
      email.trim().toLowerCase(),
      `${salt}:${derived.toString('hex')}`,
    );
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.trim());
    if (!user?.passwordHash || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const secret = this.config.get<string>('AUTH_SECRET');
    if (!secret) throw new Error('AUTH_SECRET precisa estar configurado.');
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email: user.email, role: user.role, iat: now, exp: now + 60 * 60 * 12 })}`;
    const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    return { accessToken: token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  verifyToken(token: string) {
    const secret = this.config.get<string>('AUTH_SECRET');
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = createHmac('sha256', secret).update(unsigned).digest();
    let actual: Buffer;
    try { actual = Buffer.from(parts[2], 'base64url'); } catch { return null; }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
    } catch { return null; }
  }

  private async verifyPassword(password: string, stored: string) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
