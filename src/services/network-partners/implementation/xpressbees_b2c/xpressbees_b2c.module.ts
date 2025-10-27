import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { XpressbeesB2cService } from './xpressbees_b2c.service';
import { XpressbeesB2cAuthService } from './xpressbees_b2c-auth.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [XpressbeesB2cService, XpressbeesB2cAuthService],
  exports: [XpressbeesB2cService, XpressbeesB2cAuthService],
})
export class XpressbeesB2cModule {}







