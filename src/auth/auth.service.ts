import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
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
          email,
          phone,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null
        }
      });

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roles: user.roles,
        createdAt: user.createdAt
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'ACCOUNT_IDENTIFIER_ALREADY_USED',
          message: 'Cet e-mail ou ce numéro de téléphone est déjà utilisé.'
        });
      }

      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(key);
      });
    });

    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }
}
