import { Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IDGenerationService } from './id-generation.service';
import { TokenService } from './token.service';

@Module({
  imports: [HttpModule],
  providers: [IDGenerationService, Logger, TokenService],
  exports: [IDGenerationService],
})
export class IDGenerationModule {}
