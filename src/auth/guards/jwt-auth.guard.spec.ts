import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const secret = 'test-secret-that-is-at-least-thirty-two-characters';
  const session = {
    id: 'session-1',
    user: { status: 'ACTIVE', deletedAt: null, roles: ['SENDER'] }
  };
  const prisma = {
    session: { findFirst: jest.fn() }
  } as unknown as PrismaService;

  const makeContext = (authorization?: string) => {
    const request: { headers: { authorization?: string }; user?: unknown } = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request })
    } as unknown as ExecutionContext;
    return { context, request };
  };

  const sign = (payload: Record<string, unknown>, key = secret) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode(payload);
    const signature = createHmac('sha256', key).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  };

  const claims = () => {
    const now = Math.floor(Date.now() / 1000);
    return { sub: 'user-1', sid: 'session-1', roles: ['SENDER'], iat: now, exp: now + 900 };
  };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = secret;
    jest.clearAllMocks();
    prisma.session.findFirst = jest.fn().mockResolvedValue(session);
    guard = new JwtAuthGuard(prisma);
  });

  it('rejects missing bearer token', async () => {
    const { context } = makeContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and uses current roles from the database', async () => {
    const payload = claims();
    const { context, request } = makeContext(`Bearer ${sign(payload)}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      select: { id: true, user: { select: { status: true, deletedAt: true, roles: true } } }
    });
    expect(request.user).toEqual(payload);
  });

  it('does not trust stale roles embedded in the access token', async () => {
    const payload = { ...claims(), roles: ['ADMIN'] };
    const { context, request } = makeContext(`Bearer ${sign(payload)}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ ...payload, roles: ['SENDER'] });
  });

  it('rejects a token signed with another secret', async () => {
    const { context } = makeContext(`Bearer ${sign(claims(), 'different-secret')}`);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
  });

  it('rejects expired tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { context } = makeContext(`Bearer ${sign({ ...claims(), iat: now - 1000, exp: now - 1 })}`);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens without a session id', async () => {
    const payload: Record<string, unknown> = claims();
    delete payload.sid;
    const { context } = makeContext(`Bearer ${sign(payload)}`);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects missing, revoked, or expired sessions', async () => {
    (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const { context } = makeContext(`Bearer ${sign(claims())}`);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive accounts', async () => {
    (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
      ...session,
      user: { status: 'SUSPENDED', deletedAt: null, roles: ['SENDER'] }
    });
    const { context } = makeContext(`Bearer ${sign(claims())}`);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects deleted accounts', async () => {
    (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
      ...session,
      user: { status: 'ACTIVE', deletedAt: new Date(), roles: ['SENDER'] }
    });
    const { context } = makeContext(`Bearer ${sign(claims())}`);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects malformed tokens', async () => {
    const { context } = makeContext('Bearer not.a.valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
