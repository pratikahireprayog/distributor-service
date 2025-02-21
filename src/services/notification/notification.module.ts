import { Module, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { NotificationController } from './notification.controller';
import {
  NotificationManager,
  NotificationService,
} from './notification.service';
import { IDGenerationModule } from '../id-generation/id-generation.module';
import { NotificationRepositoryModule } from 'src/common/repositories/notification/notification.module';
import { ChannelModule } from 'src/services/channel';
// import { AuthModule } from 'src/common/authentication/auth.module-1';
import { FirebaseAuthStrategy } from 'src/common/authentication/firebase/firebase-auth.strategy';
import { CustomJwtService } from 'src/common/authentication/jwt/jwt.service';
import { DeliveryAgentRepositoryModule } from 'src/common/repositories/delivery-agent/delivery-agent.module';
import { MPUserRepositoryModule } from 'src/common/repositories/mp-user/mp-user.module';
import { FirebaseService } from 'src/common/authentication/firebase/firebase.service';

@Module({
  imports: [
    IDGenerationModule,
    NotificationRepositoryModule,
    ChannelModule,
    DeliveryAgentRepositoryModule,
    MPUserRepositoryModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationManager,
    NotificationService,
    CustomJwtService,
    FirebaseAuthStrategy,
    FirebaseService,
    JwtService,
    Logger,
  ],
  // exports: [FirebaseAuthStrategy, CustomJwtService],
})
export class NotificationModule {}
