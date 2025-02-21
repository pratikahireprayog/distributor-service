import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FirebaseAuthStrategy } from './firebase-auth.strategy';
import { FirebaseService } from './firebase.service';
import { CustomJwtService } from '../jwt/jwt.service';
import { DeliveryAgentRepositoryModule } from 'src/common/repositories/delivery-agent/delivery-agent.module';
import { MPUserRepositoryModule } from 'src/common/repositories/mp-user/mp-user.module';

@Module({
  imports: [
    HttpModule,
    MPUserRepositoryModule,
    DeliveryAgentRepositoryModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user',
      session: false,
    }),
    JwtModule.register({}),
  ],
  controllers: [],
  providers: [
    FirebaseAuthStrategy,
    FirebaseService,
    FirebaseAuthStrategy,
    CustomJwtService,
  ],
  exports: [FirebaseAuthStrategy, FirebaseService, PassportModule, JwtModule],
})
export class FirebaseAuthModule {}
