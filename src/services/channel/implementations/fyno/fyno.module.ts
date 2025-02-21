// fyno.module.ts
import { Module, Logger } from '@nestjs/common';
import { FynoChannel } from './fyno';
import { FynoConfig } from './fyno.config';
import { HttpModule } from '@nestjs/axios';
import { NotificationSecretsRepositoryModule } from 'src/common/repositories/notification-secrets/notification-secrets.module';

@Module({
  imports: [HttpModule, NotificationSecretsRepositoryModule],
  providers: [FynoChannel, FynoConfig, Logger],
  exports: [FynoChannel],
})
export class FynoModule {}
