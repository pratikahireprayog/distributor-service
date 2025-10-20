import { Module, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IndiaPostInternationalService } from './indiapost-international.service';
import { IndiaPostInternationalAuthService } from './indiapost-international-auth.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [IndiaPostInternationalService, IndiaPostInternationalAuthService, Logger],
  exports: [IndiaPostInternationalService, IndiaPostInternationalAuthService],
})
export class IndiaPostInternationalModule {}

