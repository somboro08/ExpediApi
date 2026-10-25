import {
  BadRequestException, ConflictException, ForbiddenException,
  UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock; findFirst: jest.Mock }; session: { create: jest.Mock } };

  beforeEach(() => {
    prisma = {
      user: { create: jest.fn(), findFirst: jest.fn() },
      session: { create: jest.fn().mockResolvedValue({ id: 'session-id' }) }
    };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates a pending account, hashes the password and omits its hash from output', async () => {
    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: 'user-uuid', email: data.email, phone: data.phone,
      firstName: data.firstName, lastName: data.lastName,
      status: 'PENDING', roles: [], passwordHash: data.passwordHash,
      createdAt: new Date('2026-10-25T00:00:00.000Z')
    }));
    const result = await service.register({
      email: ' PERSON@EXAMPLE.COM ', password: 'a-strong-password', firstName: 'Ada'
    });
    const saved = prisma.user.create.mock.calls[0][0].data;
    expect(saved.email).toBe('person@example.com');
    expect(saved.passwordHash).toMatch(/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
    expect(saved.passwordHash).not.toBe('a-strong-password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('requires an email or phone for registration', async () => {
    await expect(service.register({ password: 'a-strong-password' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('maps duplicate identifiers to conflict', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.register({ email: 'person@example.com', password: 'a-strong-password' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects login when credentials do not match', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.login({ email: 'person@example.com', password: 'wrong-password' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('blocks a valid password for a non-active account', async () => {
    const hash = await (service as any).hashPassword('correct-password');
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-uuid', email: 'person@example.com', phone: null,
      passwordHash: hash, status: 'PENDING', roles: [], deletedAt: null
    });
    await expect(service.login({ email: 'person@example.com', password: 'correct-password' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('creates a session and returns short-lived access and refresh tokens for active users', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
    const hash = await (service as any).hashPassword('correct-password');
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-uuid', email: 'person@example.com', phone: null,
      firstName: 'Ada', lastName: null, passwordHash: hash,
      status: 'ACTIVE', roles: ['SENDER'], deletedAt: null
    });

    const result = await service.login(
      { email: 'person@example.com', password: 'correct-password' },
      { userAgent: 'Jest', ipAddress: '127.0.0.1' }
    );
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-uuid',
        refreshTokenHash: expect.any(String),
        userAgent: 'Jest',
        ipAddress: '127.0.0.1'
      })
    });
    expect(prisma.session.create.mock.calls[0][0].data.refreshTokenHash).not.toBe(result.refreshToken);
  });

  it('requires an identifier for login', async () => {
    await expect(service.login({ password: 'some-password' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
