import { PassportStrategy } from '@nestjs/passport';
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
// import { firebaseConfig } from './firebase.config';
import * as firebase from 'firebase-admin';
import { JwtPayload } from '../auth.model';
import { AUTH_TYPE } from '../auth.constant';
import { Request } from 'express';
import { FirebaseService } from './firebase.service';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth',
) {
  private defaultApp: firebase.app.App;
  constructor(private readonly service: FirebaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
    });

    // Firebase Auth initilization
    this.defaultApp = firebase.initializeApp({
      // credential: admin.credential.cert(serviceAccount)
      credential: firebase.credential.applicationDefault(),
    });
  }

  async validate(request: Request, token: string) {
    // Firebase Auth initilization

    console.log('firebase app', this.defaultApp);
    console.log('firebase auth token', token);
    console.log('headers', request.headers);
    if (token === null || token?.length === 0) {
      throw new UnauthorizedException('Token not found');
    }
    const firebaseUser: any = await this.defaultApp
      .auth()
      .verifyIdToken(token, true)
      .catch((err) => {
        console.log(err);
        throw new UnauthorizedException(err.message);
      });
    console.log('firebase user', firebaseUser);
    if (!firebaseUser) {
      throw new UnauthorizedException();
    }
    const JwtPayload: JwtPayload = {
      authType: AUTH_TYPE.DELIVERY_AGENT,
      mobile: '',
    };
    if (firebaseUser.phone_number) {
      JwtPayload.mobile = firebaseUser.phone_number.substr(
        firebaseUser.phone_number.length - 10,
      );
    }
    const user = await this.service.validateUser(JwtPayload);
    if (!user) {
      throw new HttpException(
        {
          status_code: 401,
          message: 'Please login to access this resource.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    console.log('user', user);
    request.body.user = user;
    return user;
  }
}
