import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { catchError, firstValueFrom, from, map, throwError } from 'rxjs';
import { LoginApiPayload, LoginApiResponse } from './id-generation.dto';

@Injectable()
export class TokenService {
  private token: string;
  private readonly httpService = axios.create();

  constructor(private readonly logger: Logger) {}

  // A method to set the data
  setToken(token: string): void {
    this.token = token;
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return await this.decodeToken(token);
    } catch (err) {
      // Token is invalid
      this.logger.warn('Invalid token, generating new one', err);
      this.token = await this.generateToken();
      this.logger.log('New token generated and set');
      return await this.decodeToken(this.token);
    }
  }

  private async decodeToken(token: string): Promise<any> {
    this.logger.debug('Decoding token', {
      token,
      secretType: typeof process.env.ACCESS_TOKEN_SECRET,
    });
    const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    this.logger.debug('Token decoded', { decoded });
    return decoded;
  }

  async callLoginApi(payload: LoginApiPayload): Promise<LoginApiResponse> {
    const observable$ = from(
      this.httpService.post(process.env.INNOFULFILL_LOGIN_API, payload),
    ).pipe(
      map((response) => {
        // Success case
        return response.data;
      }),
      catchError((error) => {
        this.logger.error('Error occurred:', error?.response?.data);
        console.error('Error occurred:', error?.response?.data);
        return throwError(() => ({
          statusCode: error?.response?.status,
          message: error?.response?.data,
        }));
      }),
    );

    const data = await firstValueFrom(observable$);
    return data;
  }

  async generateToken(): Promise<any> {
    try {
      const payload: LoginApiPayload = {
        email: process.env.INNOFULFILL_LOGIN_API_EMAIL_NOTIFICATION,
        password: process.env.INNOFULFILL_LOGIN_API_PASSWORD_NOTIFICATION,
        vendorType: process.env.INNOFULFILL_LOGIN_API_VENDOR_TYPE_NOTIFICATION,
      };
      const res = await this.callLoginApi(payload);
      this.logger.log(JSON.stringify(res));
      return res.data.accessToken;
    } catch (error) {
      this.logger.error(error);
    }
  }

  // A method to get the data
  async getToken(): Promise<string> {
    this.logger.log('Entering getToken method');

    if (!this.token) {
      this.logger.log('Token not found, generating new token');
      this.token = await this.generateToken();
      this.logger.log('New token generated');
      this.setToken(this.token);
      this.logger.log('Token set successfully');
      return this.token;
    }
    this.logger.log('Verifying existing token');
    const decodedToken = await this.verifyToken(this.token);
    this.logger.log('Token decoded successfully');
    const tokenExpiryTime = decodedToken.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    this.logger.log(
      `Token expiry time: ${tokenExpiryTime}, Current time: ${currentTime}`,
    );
    if (currentTime > tokenExpiryTime) {
      this.logger.log('Token expired, generating new token');
      const newToken = await this.generateToken();
      this.logger.log('New token generated');
      this.setToken(newToken);
      this.logger.log('New token set successfully');
    } else {
      this.logger.log('Token not expired, using existing token');
    }
    this.logger.log('Exiting getToken method');
    return this.token;
  }
}
