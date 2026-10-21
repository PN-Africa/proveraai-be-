import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule, ObserveInstrument, observeEnabled } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { initializeDataSource } from './database/data-source.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: observeEnabled ? ObserveInstrument : undefined,
    rawBody: true,
  });

  app.use(cookieParser());

  // Security headers (X-Content-Type-Options, HSTS, frame options, ...).
  // CSP is off because it only matters for HTML pages; this API serves JSON,
  // plus the Swagger UI, which needs inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Lets modules clean up on SIGTERM/SIGINT (e.g. closing the Redis connection)
  app.enableShutdownHooks();

  // CORS: comma-separated list in ALLOWED_ORIGINS, with local defaults
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((url) => url.trim())
    : ['http://localhost:5173', 'http://localhost:8000'];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global exception filter (consistent error shape)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe (DTO validation + transformation)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger docs at /api/docs
  const config = new DocumentBuilder()
    .setTitle('Provera AI')
    .setDescription('Provera AI fraud-detection MVP API')
    .setVersion('1.0')
    .addTag('auth')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Database: initialize connection and run pending migrations
  const logger = new Logger('bootstrap');
  try {
    await initializeDataSource();
  } catch (err) {
    logger.error('Error during data source initialization', err);
    process.exit(1);
  }

  await app.listen(process.env.PORT ?? 8000);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
