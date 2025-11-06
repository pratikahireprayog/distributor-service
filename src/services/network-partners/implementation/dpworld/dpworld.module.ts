import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DpworldService } from './dpworld.service';
import { DpworldAuthService } from './dpworld-auth.service';

/**
 * DPWORLD Network Partner Module
 * Provides DPWORLD logistics integration services
 */
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [DpworldService, DpworldAuthService],
  exports: [DpworldService, DpworldAuthService],
})
export class DpworldModule {}
