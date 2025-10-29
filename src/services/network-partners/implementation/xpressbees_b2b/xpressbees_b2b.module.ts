import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { XpressbeesB2bService } from './xpressbees_b2b.service';
import { XpressbeesB2bAuthService } from './xpressbees_b2b-auth.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [XpressbeesB2bService, XpressbeesB2bAuthService],
  exports: [XpressbeesB2bService, XpressbeesB2bAuthService],
})
export class XpressbeesB2bModule {}













