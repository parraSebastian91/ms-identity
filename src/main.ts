import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from './infrastructure/http/pipes/validation.pipe';
import { setupSwagger } from './infrastructure/http/openapi/build-openapi-document';

import * as session from 'express-session';
import { createClient } from 'redis';
import { register } from 'prom-client';

const { RedisStore } = require('connect-redis');
const cookieParser = require('cookie-parser');


async function bootstrap() {
  register.clear();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  // Los servicios siempre están detrás de APISIX: se confía en 1 salto (el gateway), de modo que req.ip es la IP que
  // vio APISIX. `trust proxy: true` confiaría en toda la cadena X-Forwarded-For y el cliente podría falsear su IP
  // (y evadir el límite por IP). Ajustable con TRUST_PROXY_HOPS si se agrega otro proxy delante.
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '', 10);
  app.getHttpAdapter().getInstance().set('trust proxy', Number.isNaN(trustProxyHops) ? 1 : trustProxyHops);
  // Deshabilitar CORS completamente

  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
  const isProd = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'http://192.168.3.10:4200', // PC-Dev
      FRONTEND_ORIGIN,
    ].filter(Boolean),
    credentials: true,
    exposedHeaders: ['Set-Cookie', 'x-request-id'],
    allowedHeaders: [
      'Content-Type',
      'Origin',
      'Accept',
      'Authorization',
      'x-request-id',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  const redisUrl = `redis://${process.env.REDIS_HOST || 'seis_erp_redis'}:${process.env.REDIS_PORT || 6379}`;
  // Cliente Redis para sesiones
  const redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => console.error('Redis (sesiones) error:', err?.message ?? err));
  // Sin connect() el store rechaza cada comando con "The client is closed" y el login falla en /security/token.
  await redisClient.connect();
  console.log(`Redis de sesiones conectado en ${redisUrl}`);

  app.use(
    session({
      store: new RedisStore({
        client: redisClient,
        prefix: process.env.PREFIX_SESSION,
        ttl: process.env.TTL_SESSION,
      }),
      name: 'auth.session',
      secret: process.env.SECRET_SESSION,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd ? 'auto' : false,
        sameSite: 'lax',
        maxAge: Number(process.env.TTL_COOKIE_SESSION),
        path: '/',
      },
    }),
  );

  // app.use((req, res, next) => {
  //   console.log('path:', req.path);
  //   console.log('X-Real-IP:', req.headers['x-real-ip']);
  //   console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
  //   console.log('IP remota:', req.ip);
  //   next();
  // });

  // Documentación OpenAPI: activa fuera de producción, o con SWAGGER_ENABLED=true.
  // UI en /docs y JSON en /docs-json (acceder directo al servicio, no por el prefijo /api/auth del gateway).
  if (!isProd || process.env.SWAGGER_ENABLED === 'true') {
    setupSwagger(app, process.env.npm_package_version);
  }

  const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;
  await app.listen(port, '0.0.0.0').then(() => {
    console.log(`Application is running on: ${port}`);
  });
}
bootstrap();
