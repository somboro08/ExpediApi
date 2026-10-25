import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns a successful health response with the expected service name', () => {
    expect(controller.getHealth()).toEqual({
      success: true,
      data: {
        status: 'ok',
        service: 'ExpediApi'
      }
    });
  });

  it('reports the status as ok', () => {
    expect(controller.getHealth().data.status).toBe('ok');
  });
});
