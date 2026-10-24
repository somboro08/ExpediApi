import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ApiErrorDetail = {
  field: string;
  issue: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;

    const details = this.getDetails(responseObject);
    const message =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Une erreur interne est survenue.'
        : this.getMessage(responseObject, exceptionResponse);

    if (!isHttpException || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `HTTP ${status} ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: this.getCode(status, responseObject),
        message,
        details
      },
      meta: {
        path: request.url,
        timestamp: new Date().toISOString()
      }
    });
  }

  private getMessage(
    responseObject: Record<string, unknown> | undefined,
    exceptionResponse: string | object | null
  ): string {
    const message = responseObject?.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return 'Les données fournies sont invalides.';
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    return 'La requête ne peut pas être traitée.';
  }

  private getDetails(
    responseObject: Record<string, unknown> | undefined
  ): ApiErrorDetail[] {
    const details = responseObject?.details;

    if (!Array.isArray(details)) {
      return [];
    }

    return details.filter(
      (detail): detail is ApiErrorDetail =>
        typeof detail === 'object' &&
        detail !== null &&
        typeof (detail as ApiErrorDetail).field === 'string' &&
        typeof (detail as ApiErrorDetail).issue === 'string'
    );
  }

  private getCode(
    status: number,
    responseObject: Record<string, unknown> | undefined
  ): string {
    if (typeof responseObject?.code === 'string') {
      return responseObject.code;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_ERROR'
          : 'REQUEST_FAILED';
    }
  }
}
