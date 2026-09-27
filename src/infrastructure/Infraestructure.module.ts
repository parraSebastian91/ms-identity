/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/databaseConfig.module';
import { HttpServerModule } from './http/http.module';
import { UsuarioRepositoryAdapter } from './adapter/usuarioRepository.adapter';
import { ContactoRepositoryAdapter } from './adapter/contactoRepository.adapter';
import { RolRepositoryAdapter } from './adapter/rolRepository.adapter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactoEntity } from './database/entities/contacto.entity';
import { ModuloEntity } from './database/entities/modulo.entity';
import { PermisoEntity } from './database/entities/permisos.entity';
import { RolEntity } from './database/entities/rol.entity';
import { RolModuloPermisoEntity } from './database/entities/rolModuloPermiso.entity';
import { SistemaEntity } from './database/entities/sistema.entity';
import { TipoContactoEntity } from './database/entities/tipoContacto.entity';
import { UsuarioEntity } from './database/entities/usuario.entity';
import { FuncionalidadEntity } from './database/entities/funcionalidad.entity';
import { RefreshSessionEntity } from './database/entities/RefreshSession.entity';
import { RefreshSessionRepositoryAdapter } from './adapter/RefresshSessionRepository.adapter';
import {
  ConfigModule,
  ConfigService,
  ConfigModule as NestConfigModule,
} from '@nestjs/config';
import { MetricsModule } from './metrics/metrics.module';
import { PasswordResetRepositoryAdapter } from './adapter/passwordResetRepository.adapter';
import { UserProfileRepositoryAdapter } from './adapter/userProfileRepository.adapter';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { CacheRepositoryAdapter } from './adapter/cacheRepository.adapter';
import { ConsoleEmailAdapter } from './adapter/consoleEmail.adapter';
import { EMAIL_SERVICE } from '../core/domain/puertos/outbound/IEmailService.interface';

@Module({
  imports: [
    DatabaseModule,
    HttpServerModule,
    MetricsModule,
    ConfigModule,
    TypeOrmModule.forFeature([
      ContactoEntity,
      ModuloEntity,
      PermisoEntity,
      RolEntity,
      RolModuloPermisoEntity,
      SistemaEntity,
      TipoContactoEntity,
      UsuarioEntity,
      FuncionalidadEntity,
      RefreshSessionEntity,
    ]),
    // Caché compartida en Redis (códigos de autorización, access token por sesión, OTP): nada vive en la instancia.
    // Las claves las lee también el BFF, así que deben estar en el mismo Redis/db.
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('redis.host', 'seis_erp_redis');
        const port = configService.get<number>('redis.port', 6379);
        const db = configService.get<number>('redis.db', 0);
        return { stores: [new KeyvRedis(`redis://${host}:${port}/${db}`)] };
      },
    }),
  ],
  providers: [
    UsuarioRepositoryAdapter,
    ContactoRepositoryAdapter,
    RolRepositoryAdapter,
    RefreshSessionRepositoryAdapter,
    PasswordResetRepositoryAdapter,
    UserProfileRepositoryAdapter,
    CacheRepositoryAdapter,
    { provide: EMAIL_SERVICE, useClass: ConsoleEmailAdapter },
  ],
  exports: [
    UsuarioRepositoryAdapter,
    ContactoRepositoryAdapter,
    RolRepositoryAdapter,
    RefreshSessionRepositoryAdapter,
    MetricsModule,
    PasswordResetRepositoryAdapter,
    UserProfileRepositoryAdapter,
    CacheRepositoryAdapter,
    EMAIL_SERVICE,
  ],
})
export class InfraestructureModule {}