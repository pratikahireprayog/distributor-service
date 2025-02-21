import { NotificationRequestDto } from 'src/common/dtos/notification.dto';

export abstract class BaseChannel {
  abstract sendNotification(
    user: any,
    notificationId: string,
    notification: NotificationRequestDto,
  );
}
