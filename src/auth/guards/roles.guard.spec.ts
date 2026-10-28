import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let request: { user?: { roles?: string[] } };
  let context: ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
    request = {};
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as unknown as ExecutionContext;
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );
  });

  it('allows a user with one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'MODERATOR']);
    request.user = { roles: ['SENDER', 'ADMIN'] };

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a user without a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    request.user = { roles: ['SENDER'] };

    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when the request has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when the user roles are malformed', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    request.user = { roles: undefined };

    expect(guard.canActivate(context)).toBe(false);
  });
});
