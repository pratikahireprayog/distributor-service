import { Module } from '@nestjs/common';
import { NotificationLogRepository } from './notification-log.repository';
import { notificationLogProviders } from './notification-log.provider';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [NotificationLogRepository, ...notificationLogProviders],
  exports: [NotificationLogRepository],
})
export class NotificationLogRepositoryModule {}
