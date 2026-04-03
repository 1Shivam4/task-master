import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkStrategy } from './clerk.strategy';
import { ClerkClientProvider } from '../providers/clerk-client.provider';

@Module({
  imports: [ConfigModule],
  providers: [ClerkStrategy, ClerkClientProvider],
  exports: [ClerkStrategy],
})
export class AuthModule {}
