import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let request: Request;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new ApiExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    request = {
      method: 'POST',
      url: '/v1/example'
    } as Request;

    const response = { status } as unknown as Response;
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request
      })
    } as unknown as ArgumentsHost;
  });

  it('formats client errors using the shared envelope', () => {
    const exception = new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Les données fournies sont invalides.',
      details: [{ field: 'email', issue: 'must be an email' }]
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Les données fournies sont invalides.',
          details: [{ field: 'email', issue: 'must be an email' }]
        },
        meta: expect.objectContaining({
          path: '/v1/example',
          timestamp: expect.any(String)
        })
      })
    );
  });

  it('does not expose internal error details to clients', () => {
    const exception = new Error('database password leaked in this message');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Une erreur interne est survenue.',
          details: []
        }
      })
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain(
      'database password'
    );
  });

  it('keeps the HTTP status for regular Nest exceptions', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Not found'
        })
      })
    );
  });
});
