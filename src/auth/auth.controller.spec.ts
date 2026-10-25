import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { register: jest.Mock };
  const createdAccount = {
    id: 'user-uuid',
    email: 'person@example.com',
    phone: null,
    firstName: null,
    lastName: null,
    status: 'PENDING',
    roles: [],
    createdAt: new Date('2026-10-25T00:00:00.000Z')
  };

  beforeEach(() => {
    authService = { register: jest.fn().mockResolvedValue(createdAccount) };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('returns the standard success envelope for a registration', async () => {
    const dto = {
      email: 'person@example.com',
      password: 'a-strong-password'
    };

    await expect(controller.register(dto)).resolves.toEqual({
      success: true,
      data: createdAccount
    });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('propagates service errors to the global exception filter', async () => {
    const error = new Error('service failed');
    authService.register.mockRejectedValueOnce(error);

    await expect(
      controller.register({
        email: 'person@example.com',
        password: 'a-strong-password'
      })
    ).rejects.toBe(error);
  });
});
