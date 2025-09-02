import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { DeliveryAgentRepository } from 'src/common/repositories/delivery-agent/delivery-agent.repository';
import { MPUserRepository } from 'src/common/repositories/mp-user/mp-user.repository';
import { JWT_ENV_CONST } from '../auth.constant';

@Injectable()
export class CustomJwtService {
  constructor(
    private readonly deliveryAgentRepository: DeliveryAgentRepository,
    private readonly mpUserRepository: MPUserRepository,
  ) {}

  async verifyToken(token: string): Promise<any> {
    try {
      console.log(
        'token',
        token,
        process.env.ACCESS_TOKEN_SECRET,
        typeof process.env.ACCESS_TOKEN_SECRET,
      );
      const accessToken = token.replace('Bearer ', '');
      const decoded = await jwt.verify(
        accessToken,
        process.env[JWT_ENV_CONST.ACCESS_TOKEN_SECRET],
      );
      console.log('decoded', decoded);
      return decoded;
    } catch (err) {
      // Token is invalid
      console.log('err', err);
      throw new HttpException(
        {
          status_code: 401,
          message: 'Please login to access this resource.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async validateUser(payload: any) {
    if (!payload.email) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const authUser = await this.findMPUser(payload.email);
    console.log('authUser', authUser);
    const userData: any = { ...authUser, authType: payload.authType };
    const user = userData;
    console.log('user', user);
    return user; // Return the user if found, or null/undefined if not found
  }

  async findMPUser(email: string): Promise<any> {
    return await this.mpUserRepository.getOne({
      email: email.toLowerCase(),
      isActive: true,
    });
  }

  async generateToken(payload): Promise<any> {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.JWT_EXPIRY_TIME || '1h',
    });
  }
}
