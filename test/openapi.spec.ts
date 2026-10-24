import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

describe('OpenAPI contract', () => {
  const document = parse(
    readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')
  );

  it('uses OpenAPI 3.1', () => {
    expect(document.openapi).toBe('3.1.0');
  });

  it('contains the expected API surface', () => {
    expect(Object.keys(document.paths).length).toBeGreaterThanOrEqual(100);
    const operations = Object.values(document.paths).flatMap((pathItem: any) =>
      Object.entries(pathItem).filter(([key]) =>
        ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(key)
      )
    );
    expect(operations.length).toBeGreaterThanOrEqual(150);
  });

  it('has unique operation IDs', () => {
    const ids = Object.values(document.paths).flatMap((pathItem: any) =>
      Object.entries(pathItem)
        .filter(([key]) =>
          ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(key)
        )
        .map(([, operation]: [string, any]) => operation.operationId)
    );
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines common success and error response schemas', () => {
    expect(document.components.schemas.SuccessResponse).toBeDefined();
    expect(document.components.schemas.ErrorResponse).toBeDefined();
    expect(document.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});
