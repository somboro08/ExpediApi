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
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;

    if (!email && !phone) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: 'Un e-mail ou un numéro de téléphone est requis.'
      });
    }

    const passwordHash = await this.hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email, phone, passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null
        }
      });
      return {
        id: user.id, email: user.email, phone: user.phone,
        firstName: user.firstName, lastName: user.lastName,
        status: user.status, roles: user.roles, createdAt: user.createdAt
      };
    } catch (error: unknown) {
      if (this.isPrismaCode(error, 'P2002')) {
        throw new ConflictException({
          code: 'ACCOUNT_IDENTIFIER_ALREADY_USED',
          message: 'Cet e-mail ou ce numéro de téléphone est déjà utilisé.'
        });
      }
      throw error;
    }
  }

  async login(dto: LoginDto, metadata: { userAgent?: string; ipAddress?: string } = {}) {
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();
    if (!email && !phone) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: 'Un e-mail ou un numéro de téléphone est requis.'
      });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        deletedAt: null
      }
    });

    if (!user?.passwordHash || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants incorrects.'
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Ce compte n’est pas encore actif.'
      });
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException({
        code: 'AUTH_CONFIGURATION_ERROR',
        message: 'La configuration de l’authentification est incomplète.'
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = this.signAccessToken({
      sub: user.id,
      roles: user.roles,
      iat: now,
      exp: now + 900
    }, secret);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        userAgent: metadata.userAgent?.slice(0, 512),
        ipAddress: metadata.ipAddress?.slice(0, 64)
      }
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roles: user.roles
      }
    };
  }

  private signAccessToken(payload: Record<string, unknown>, secret: string): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode(payload);
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await this.scryptAsync(password, salt);
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algorithm, salt, keyHex] = encoded.split('$');
    if (algorithm !== 'scrypt' || !salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex)) return false;
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== 64) return false;
    const actual = await this.scryptAsync(password, salt);
    return timingSafeEqual(expected, actual);
  }

  private scryptAsync(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
    });
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}
