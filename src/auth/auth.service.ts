import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;
    if (!email && !phone) {
      throw new BadRequestException({ code: 'IDENTIFIER_REQUIRED', message: 'Un e-mail ou un numéro de téléphone est requis.' });
    }
    const passwordHash = await this.hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { email, phone, passwordHash, firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null }
      });
      return { id: user.id, email: user.email, phone: user.phone, firstName: user.firstName, lastName: user.lastName, status: user.status, roles: user.roles, createdAt: user.createdAt };
    } catch (error: unknown) {
      if (this.isPrismaCode(error, 'P2002')) {
        throw new ConflictException({ code: 'ACCOUNT_IDENTIFIER_ALREADY_USED', message: 'Cet e-mail ou ce numéro de téléphone est déjà utilisé.' });
      }
      throw error;
    }
  }

  async login(dto: LoginDto, metadata: { userAgent?: string; ipAddress?: string } = {}) {
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();
    if (!email && !phone) throw new BadRequestException({ code: 'IDENTIFIER_REQUIRED', message: 'Un e-mail ou un numéro de téléphone est requis.' });

    const user = await this.prisma.user.findFirst({
      where: { ...(email ? { email } : {}), ...(phone ? { phone } : {}), deletedAt: null }
    });
    if (!user?.passwordHash || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects.' });
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Ce compte n’est pas encore actif.' });

    const accessToken = this.createAccessToken(user);
    const refreshToken = this.newRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
        userAgent: metadata.userAgent?.slice(0, 512),
        ipAddress: metadata.ipAddress?.slice(0, 64)
      }
    });
    return {
      accessToken, tokenType: 'Bearer', expiresIn: 900, refreshToken, refreshTokenExpiresAt: expiresAt,
      user: { id: user.id, email: user.email, phone: user.phone, firstName: user.firstName, lastName: user.lastName, status: user.status, roles: user.roles }
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'Le compte associé à ce jeton n’existe plus.' });
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Ce compte n’est plus actif.' });
    }
    return {
      id: user.id, email: user.email, phone: user.phone, firstName: user.firstName,
      lastName: user.lastName, status: user.status, roles: user.roles, createdAt: user.createdAt
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true }
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Le jeton de renouvellement est invalide ou expiré.' });
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) {
      throw new ForbiddenException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Ce compte n’est pas actif.' });
    }

    const nextRefreshToken = this.newRefreshToken();
    const nextHash = this.hashRefreshToken(nextRefreshToken);
    const nextExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const rotation = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { refreshTokenHash: nextHash, expiresAt: nextExpiry, lastUsedAt: new Date() }
    });
    if (rotation.count !== 1) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Le jeton de renouvellement a déjà été utilisé ou est expiré.' });
    }
    return {
      accessToken: this.createAccessToken(session.user),
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: nextExpiry
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return { loggedOut: true };
  }

  private createAccessToken(user: { id: string; roles: string[] }): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException({ code: 'AUTH_CONFIGURATION_ERROR', message: 'La configuration de l’authentification est incomplète.' });
    }
    const now = Math.floor(Date.now() / 1000);
    return this.signAccessToken({ sub: user.id, roles: user.roles, iat: now, exp: now + 900 }, secret);
  }

  private signAccessToken(payload: Record<string, unknown>, secret: string): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode(payload);
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }
  private newRefreshToken(): string { return randomBytes(48).toString('base64url'); }
  private hashRefreshToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    return `scrypt$${salt}$${(await this.scryptAsync(password, salt)).toString('hex')}`;
  }
  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algorithm, salt, keyHex] = encoded.split('$');
    if (algorithm !== 'scrypt' || !salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex)) return false;
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== 64) return false;
    return timingSafeEqual(expected, await this.scryptAsync(password, salt));
  }
  private scryptAsync(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  }
  private isPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}
