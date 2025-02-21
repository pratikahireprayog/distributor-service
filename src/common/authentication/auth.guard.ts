import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthStrategy } from './firebase/firebase-auth.strategy';
import { CustomJwtService } from './jwt/jwt.service';
@Injectable()
export class AuthGuardRole extends AuthGuard('firebase-auth') {
  constructor(
    private reflector: Reflector,
    private strategy: FirebaseAuthStrategy,
    private customJwtService: CustomJwtService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);
    console.log('isPublic', isPublic);

    const request = context.switchToHttp().getRequest();
    console.log('initial api request url', request.originalUrl);
    console.log('initial api request headers', request.headers);
    console.log('initial api request body', request.body);

    if (isPublic) {
      return true;
    }

    const authType = request?.headers?.authtype?.toLowerCase();
    const authorization = request?.headers?.authorization;

    if (!authType || authType === 'jwt') {
      // Use JWT authentication
      const jwtData = await this.customJwtService.verifyToken(authorization);
      if (jwtData) {
        request.user = jwtData; // Attach token data to request
        return true;
      }
      return false;
    } else if (authType === 'firebase') {
      const canActivate = await super.canActivate(context);
      if (canActivate) {
        const firebaseData = await this.strategy.validate(
          request,
          authorization,
        );
        request.user = firebaseData; // Attach token data to request
        return true;
      }
      return false;
    } else {
      throw new HttpException(
        {
          statusCode: 400,
          message: `Invalid authtype. Must be either 'jwt' or 'firebase'`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

// import { Injectable } from '@nestjs/common';
// import { ExecutionContext } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { Observable } from 'rxjs';
// import { FirebaseAuthStrategy } from './firebase/firebase-auth.strategy';
// import { jwtService } from './jwt/jwt.service';

// @Injectable()
// export class AuthGuardRole extends AuthGuard('jwt') {
//     constructor(private strategy: FirebaseAuthStrategy, private jwtService:jwtService) {
//     super();
//   }
//   async canActivate(context: ExecutionContext) {
//     const request = context.switchToHttp().getRequest();

//     console.log("initial api request url", request.originalUrl);
//     console.log("initial api request headers", request.headers);
//     console.log("initial api request body", request.body);

//     switch (request.headers.authtype?.toLowerCase()) {
//       case 'jwt':
//         return super.canActivate(context); // Use JwtAuthGuard to validate JWT token
//         // return await this.jwtService.validateUser(request.headers.authorization);
//       case 'firebase':
//         return this.strategy.validate(request, request?.header?.authorization); // Use FirebaseAuthStrategy to validate Firebase token
//         return true; // Assuming Firebase logic succeeds
//       default:
//         return false; // Invalid authtype
//     }
//   }
// }
