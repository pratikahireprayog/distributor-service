import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EkartService } from './ekart.service';
import { EkartAuthService } from './ekart-auth.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [EkartService, EkartAuthService],
  exports: [EkartService, EkartAuthService],
})
export class EkartModule {}
