import { Module, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChannelFactory } from './channel.factory';
import { channelProviders } from './channel.provider';
import { FynoModule } from './implementations/fyno/fyno.module';

@Module({
  imports: [FynoModule, HttpModule],
  providers: [ChannelFactory, Logger, ...channelProviders],
  exports: [ChannelFactory],
})
export class ChannelModule {}
