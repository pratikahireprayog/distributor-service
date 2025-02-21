import { Module } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { notificationProviders } from './notification.provider';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [NotificationRepository, ...notificationProviders],
  exports: [NotificationRepository],
})
export class NotificationRepositoryModule {}
