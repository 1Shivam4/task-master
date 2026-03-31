import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { createLoggerConfig } from './common/logger/logger.config';
import { AllExceptionFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    WinstonModule.forRoot(createLoggerConfig()),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
