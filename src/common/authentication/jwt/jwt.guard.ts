import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    switch (request.headers.authtype?.toLowerCase()) {
      case 'jwt':
        return super.canActivate(context); // Use JwtAuthGuard to validate JWT token
      case 'firebase':
        // Implement Firebase authentication logic here
        return true; // Assuming Firebase logic succeeds
      default:
        return false; // Invalid authtype
    }
  }
}
