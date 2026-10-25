import {
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService.register', () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock } };

  beforeEach(() => {
    prisma = { user: { create: jest.fn() } };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('creates a pending account and never returns the password hash', async () => {
    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: 'user-uuid',
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      status: 'PENDING',
      roles: [],
      passwordHash: data.passwordHash,
      createdAt: new Date('2026-10-25T00:00:00.000Z')
    }));

    const result = await service.register({
      email: '  PERSON@EXAMPLE.COM ',
      password: 'a-strong-password',
      firstName: 'Ada'
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'person@example.com',
        phone: null,
        firstName: 'Ada',
        lastName: null
      })
    });
    const savedData = prisma.user.create.mock.calls[0][0].data;
    expect(savedData.passwordHash).toMatch(/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
    expect(savedData.passwordHash).not.toBe('a-strong-password');
    expect(result).toEqual({
      id: 'user-uuid',
      email: 'person@example.com',
      phone: null,
      firstName: 'Ada',
      lastName: null,
      status: 'PENDING',
      roles: [],
      createdAt: new Date('2026-10-25T00:00:00.000Z')
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('requires an email or phone number', async () => {
    await expect(
      service.register({ password: 'a-strong-password' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('maps duplicate identifiers to a conflict response', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.register({
        email: 'person@example.com',
        password: 'a-strong-password'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not silently swallow unexpected database errors', async () => {
    const databaseError = new Error('database unavailable');
    prisma.user.create.mockRejectedValue(databaseError);

    await expect(
      service.register({
        email: 'person@example.com',
        password: 'a-strong-password'
      })
    ).rejects.toBe(databaseError);
  });
});
