import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: { sub: string; roles: string[]; iat: number; exp: number };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Un jeton Bearer est requis.' });
    }
    const token = authorization.slice(7).trim();
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException({ code: 'AUTH_CONFIGURATION_ERROR', message: 'La configuration de l’authentification est incomplète.' });
    }
    const parts = token.split('.');
    if (parts.length !== 3) this.invalidToken();
    const [headerPart, payloadPart, signaturePart] = parts;
    try {
      const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
      const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { sub?: unknown; roles?: unknown; iat?: unknown; exp?: unknown };
      if (header.alg !== 'HS256' || header.typ !== 'JWT') this.invalidToken();
      const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest();
      const actual = Buffer.from(signaturePart, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) this.invalidToken();
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.sub !== 'string' || !payload.sub ||
          !Array.isArray(payload.roles) || !payload.roles.every(role => typeof role === 'string') ||
          typeof payload.exp !== 'number' || payload.exp <= now ||
          typeof payload.iat !== 'number' || payload.iat > now + 60) this.invalidToken();
      request.user = { sub: payload.sub, roles: payload.roles, iat: payload.iat, exp: payload.exp };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.invalidToken();
    }
  }

  private invalidToken(): never {
    throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN', message: 'Le jeton d’accès est invalide ou expiré.' });
  }
}
