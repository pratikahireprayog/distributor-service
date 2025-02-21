import { Module } from '@nestjs/common';
import { NotificationSecretsRepository } from './notification-secrets.repository';
import { notificationSecretsProviders } from './notification-secrets.provider';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [NotificationSecretsRepository, ...notificationSecretsProviders],
  exports: [NotificationSecretsRepository],
})
export class NotificationSecretsRepositoryModule {}
