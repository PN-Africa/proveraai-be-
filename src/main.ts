import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule, ObserveInstrument, observeEnabled } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { initializeDataSource } from './database/data-source.js';
import { seedAccounts } from './database/seed-accounts.js';
import { ACCESS_TOKEN_COOKIE } from './modules/auth/services/auth-cookie.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: observeEnabled ? ObserveInstrument : undefined,
    rawBody: true,
  });

  // Behind a load balancer, trust that many proxy hops so request.ip is the
  // real client (rate limits and login logs depend on it)
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.use(cookieParser());

  app.use(helmet({ contentSecurityPolicy: false }));

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
    .addTag('users')
    .addTag('uploads')
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Database: initialize connection, run pending migrations, then seed
  const logger = new Logger('bootstrap');
  try {
    await initializeDataSource();

    try {
      await seedAccounts();
      logger.log('Database seeding completed!');
    } catch (seedError) {
      logger.error('Error during database seeding', seedError);
    }
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
