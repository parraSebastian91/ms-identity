/*
https://docs.nestjs.com/modules
*/

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DynamicModule, Module, Type } from '@nestjs/common';
import { AuthAplicationService } from './aplication/service/auth.service';
import { AuthorizationUseCase } from './aplication/useCase/authorization/authorization.usecase';
import { SessionUseCase } from './aplication/useCase/session/session.usecase';
import { PasswordResetUseCase } from './aplication/useCase/passwordReset/passwordReset.usecase';
import { AUTHORIZATION_USE_CASE } from './domain/puertos/inbound/IAuthorizationUseCase.interface';
import { SESSION_USE_CASE } from './domain/puertos/inbound/ISessionUseCase.interface';
import { PASSWORD_RESET_USE_CASE } from './domain/puertos/inbound/IPasswordResetUseCase.interface';
import { IUsuarioRepository } from './domain/puertos/outbound/iUsuarioRepository.interface';
import { IContactoRepository } from './domain/puertos/outbound/iContactoRepository.interface';
import { IRolRepository } from './domain/puertos/outbound/iRolRepository.interface';
import { IRefreshSessionRepository } from './domain/puertos/outbound/iRefreshSessionRepository.interface';
import { IPasswordResetRepository } from './domain/puertos/outbound/IPasswordResetRepository.interface';
import { CacheRepositoryAdapter } from 'src/infrastructure/adapter/cacheRepository.adapter';
import { ICacheRepository } from './domain/puertos/outbound/CacheRepository.interface';
import { IEmailService, EMAIL_SERVICE } from './domain/puertos/outbound/IEmailService.interface';
import { RegistroUseCaseImpl } from './aplication/useCase/registro/registro.usecase.impl';
import { IUserProfileRepository } from './domain/puertos/outbound/IUserProfileRepository.interface';
import { USER_PROFILE_USE_CASE } from './domain/puertos/inbound/IUserProfile.usecase.interface';
import { UserProfileUseCase } from './aplication/useCase/userProfile/userProfile.usecase';

export type CoreModuleOptions = {
    modules: any[];
    adapters: {
        usuarioRepository: Type<IUsuarioRepository>;
        contactoRepository: Type<IContactoRepository>;
        rolRepository: Type<IRolRepository>;
        refreshSessionRepository: Type<IRefreshSessionRepository>;
        passwordResetRepository: Type<IPasswordResetRepository>;
        cacheRepository: Type<ICacheRepository>;
        userProfileRepository: Type<IUserProfileRepository>;
    }
}

// Application USE CASE reference
export const REGISTRO_USE_CASE = 'REGISTRO_USE_CASE';

// Application services reference
export const AUTH_APPLICATION_SERVICE = 'AUTH_APPLICATION_SERVICE'

// Domain services references;



@Module({})
export class CoreModule {

    static register(options: CoreModuleOptions): DynamicModule {
        const { adapters, modules } = options;
        const {
            usuarioRepository,
            contactoRepository,
            refreshSessionRepository,
            passwordResetRepository,
            cacheRepository,
            rolRepository,
            userProfileRepository,
        } = adapters;

        // Auth Service Provider

        const authAplicationServiceProvider = {
            provide: AUTH_APPLICATION_SERVICE,
            useFactory(
                cacheRepository: ICacheRepository,
                refreshSessionRepo: IRefreshSessionRepository,
                jwtService: JwtService,
                configService: ConfigService,
            ) {
                return new AuthAplicationService(
                    cacheRepository,
                    refreshSessionRepo,
                    jwtService,
                    configService,
                );
            },
            inject: [cacheRepository, refreshSessionRepository, JwtService, ConfigService],
        };

        const registroUseCaseProvider = {
            provide: REGISTRO_USE_CASE,
            inject: [
                usuarioRepository,
                contactoRepository,
                cacheRepository,
                EMAIL_SERVICE,
                rolRepository,
            ],
            useFactory(
                authRepository: IUsuarioRepository,
                contactoRepository: IContactoRepository,
                cacheRepository: ICacheRepository,
                emailService: IEmailService,
                rolRepository: IRolRepository,
            ) {
                return new RegistroUseCaseImpl(
                    authRepository,
                    contactoRepository,
                    cacheRepository,
                    emailService,
                    rolRepository,
                );
            },
        };

        const userProfileUseCaseProvider = {
            provide: USER_PROFILE_USE_CASE,
            inject: [userProfileRepository],
            useFactory(repository: IUserProfileRepository) {
                return new UserProfileUseCase(repository);
            },
        };

        const authorizationUseCaseProvider = {
            provide: AUTHORIZATION_USE_CASE,
            inject: [usuarioRepository, AUTH_APPLICATION_SERVICE, cacheRepository],
            useFactory(
                usuarioRepo: IUsuarioRepository,
                authService: AuthAplicationService,
                cacheRepo: ICacheRepository,
            ) {
                return new AuthorizationUseCase(usuarioRepo, authService, cacheRepo);
            },
        };

        const sessionUseCaseProvider = {
            provide: SESSION_USE_CASE,
            inject: [
                usuarioRepository,
                refreshSessionRepository,
                AUTH_APPLICATION_SERVICE,
                JwtService,
                cacheRepository,
                ConfigService,
            ],
            useFactory(
                usuarioRepo: IUsuarioRepository,
                refreshSessionRepo: IRefreshSessionRepository,
                authService: AuthAplicationService,
                jwtService: JwtService,
                cacheRepo: ICacheRepository,
                configService: ConfigService,
            ) {
                return new SessionUseCase(usuarioRepo, refreshSessionRepo, authService, jwtService, cacheRepo, configService);
            },
        };

        const passwordResetUseCaseProvider = {
            provide: PASSWORD_RESET_USE_CASE,
            inject: [usuarioRepository, contactoRepository, passwordResetRepository, AUTH_APPLICATION_SERVICE, EMAIL_SERVICE, ConfigService],
            useFactory(
                usuarioRepo: IUsuarioRepository,
                contactoRepo: IContactoRepository,
                passwordResetRepo: IPasswordResetRepository,
                authService: AuthAplicationService,
                emailService: IEmailService,
                configService: ConfigService,
            ) {
                const frontendUrl = configService.get<string>('app.frontendUrl') || 'http://localhost:8000';
                return new PasswordResetUseCase(usuarioRepo, contactoRepo, passwordResetRepo, authService, emailService, { frontendUrl });
            },
        };

        return {
            module: CoreModule,
            global: true,
            imports: [
                ...modules,
            ],
            providers: [
                JwtService,
                authAplicationServiceProvider,
                authorizationUseCaseProvider,
                sessionUseCaseProvider,
                passwordResetUseCaseProvider,
                registroUseCaseProvider,
                userProfileUseCaseProvider,
            ],
            exports: [
                REGISTRO_USE_CASE,
                AUTHORIZATION_USE_CASE,
                SESSION_USE_CASE,
                PASSWORD_RESET_USE_CASE,
                USER_PROFILE_USE_CASE,
            ],
        };
    }

}
