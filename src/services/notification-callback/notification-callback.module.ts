import { Module, Logger } from '@nestjs/common';
import { NotificationCallbackController } from './notification-callback.controller';
import {
  // NotificationCallbackManager,
  NotificationCallbackService,
} from './notification-callback.service';
import { NotificationLogRepositoryModule } from 'src/common/repositories/notification-log/notification-log.module';

@Module({
  imports: [NotificationLogRepositoryModule],
  controllers: [NotificationCallbackController],
  providers: [NotificationCallbackService, Logger],
})
export class NotificationCallbackModule {}
