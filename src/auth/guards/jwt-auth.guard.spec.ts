import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const secret = 'test-secret-that-is-at-least-thirty-two-characters';

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

  beforeEach(() => { process.env.JWT_ACCESS_SECRET = secret; guard = new JwtAuthGuard(); });

  it('rejects missing bearer token', () => {
    const { context } = makeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts a valid signed token and attaches its claims to the request', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = sign({ sub: 'user-1', roles: ['SENDER'], iat: now, exp: now + 900 });
    const { context, request } = makeContext(`Bearer ${token}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ sub: 'user-1', roles: ['SENDER'], iat: now, exp: now + 900 });
  });

  it('rejects a token signed with another secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const { context } = makeContext(`Bearer ${sign({ sub: 'user-1', roles: [], iat: now, exp: now + 900 }, 'different-secret')}`);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', () => {
    const now = Math.floor(Date.now() / 1000);
    const { context } = makeContext(`Bearer ${sign({ sub: 'user-1', roles: [], iat: now - 1000, exp: now - 1 })}`);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects malformed tokens', () => {
    const { context } = makeContext('Bearer not.a.valid-token');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
