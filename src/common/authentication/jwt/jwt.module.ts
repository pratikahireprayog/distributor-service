// auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { CustomJwtService } from './jwt.service';
import { JWT_ENV_CONST } from '../auth.constant';
import { MPUserRepositoryModule } from 'src/common/repositories/mp-user/mp-user.module';
import { DeliveryAgentRepositoryModule } from 'src/common/repositories/delivery-agent/delivery-agent.module';

@Module({
  imports: [
    MPUserRepositoryModule,
    DeliveryAgentRepositoryModule,
    JwtModule.register({
      secret: process.env[JWT_ENV_CONST.ACCESS_TOKEN_SECRET],
      signOptions: { expiresIn: '1d' }, // Adjust as per your needs
    }),
  ],
  providers: [CustomJwtService, JwtStrategy],
  exports: [CustomJwtService, JwtStrategy, JwtModule],
})
export class JwtAuthModule {}
