import { Module, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { XpressbeesService } from './xpressbees.service';
import { XpressbeesAuthService } from './xpressbees-auth.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [XpressbeesService, XpressbeesAuthService, Logger],
  exports: [XpressbeesService, XpressbeesAuthService],
})
export class XpressbeesModule {}
