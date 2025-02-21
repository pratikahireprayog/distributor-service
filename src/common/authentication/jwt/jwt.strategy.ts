import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CustomJwtService } from './jwt.service';
// import { JwtPayload } from './auth.models';
import { Request } from 'express';
import { JwtPayload } from '../auth.model';
import { JWT_ENV_CONST } from '../auth.constant';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly service: CustomJwtService) {
    console.log(
      `process.env.ACCESS_TOKEN_SECRET = ${process.env[JWT_ENV_CONST.ACCESS_TOKEN_SECRET]}`,
    );
    const token = ExtractJwt.fromAuthHeaderAsBearerToken();
    console.log('token: ', token);
    super({
      jwtFromRequest: token,
      secretOrKey: `${process.env.ACCESS_TOKEN_SECRET}`,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<JwtPayload> {
    // console.log(request);
    console.log('payload: ', payload);
    const user = await this.service.validateUser(payload);
    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    request.body.user = user;
    return user;
  }
}
