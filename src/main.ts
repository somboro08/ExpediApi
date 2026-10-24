import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  const contractPath = resolve(process.cwd(), 'openapi/openapi.yaml');
  const contractYaml = readFileSync(contractPath, 'utf8');
  const openApiDocument = parse(contractYaml);

  SwaggerModule.setup('docs', app, openApiDocument, {
    customSiteTitle: 'ExpediApi — Documentation API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none'
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`ExpediApi listening on http://localhost:${port}/v1`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

bootstrap();
