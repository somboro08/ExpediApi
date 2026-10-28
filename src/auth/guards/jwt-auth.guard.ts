import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: { sub: string; sid: string; roles: string[]; iat: number; exp: number };
}

interface AccessTokenPayload {
  sub?: unknown;
  sid?: unknown;
  roles?: unknown;
  iat?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    let payload: AccessTokenPayload;
    try {
      const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as AccessTokenPayload;
      if (header.alg !== 'HS256' || header.typ !== 'JWT') this.invalidToken();

      const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest();
      const actual = Buffer.from(signaturePart, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) this.invalidToken();

      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.sub !== 'string' || !payload.sub ||
          typeof payload.sid !== 'string' || !payload.sid ||
          !Array.isArray(payload.roles) || !payload.roles.every(role => typeof role === 'string') ||
          typeof payload.exp !== 'number' || payload.exp <= now ||
          typeof payload.iat !== 'number' || payload.iat > now + 60) this.invalidToken();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.invalidToken();
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid as string,
        userId: payload.sub as string,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { id: true, user: { select: { status: true, deletedAt: true, roles: true } } }
    });

    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'La session est invalide, révoquée ou expirée.' });
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) {
      throw new ForbiddenException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Ce compte n’est plus actif.' });
    }

    // Roles are read from the database, not trusted from the token, so role changes
    // take effect on the next request even while an access token remains valid.
    request.user = {
      sub: payload.sub as string,
      sid: payload.sid as string,
      roles: session.user.roles,
      iat: payload.iat as number,
      exp: payload.exp as number
    };
    return true;
  }

  private invalidToken(): never {
    throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN', message: 'Le jeton d’accès est invalide ou expiré.' });
  }
}
