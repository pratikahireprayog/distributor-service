import { Module, Logger } from '@nestjs/common';
import { FirebaseAuthModule } from './firebase/firebase-auth.module';
import { JwtAuthModule } from './jwt/jwt.module';

@Module({
  imports: [JwtAuthModule, FirebaseAuthModule],
  controllers: [],
  providers: [Logger],
  exports: [],
})
export class AuthModule {}
