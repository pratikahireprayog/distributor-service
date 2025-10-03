import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { URBANBOLT_API_URLS, URBANBOLT_AUTH_CONFIG } from './urbanbolt-constants';
import { UrbanBoltAuthRequestDto, UrbanBoltAuthResponseDto } from './urbanbolt.dto';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class UrbanBoltAuthService implements AuthProvider {
  private readonly logger = new Logger(UrbanBoltAuthService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAuthToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new token
    await this.authenticate();
    return this.accessToken!;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async authenticate(): Promise<void> {
    try {
      const authUrl = `${URBANBOLT_API_URLS.BASE_URL}${URBANBOLT_API_URLS.AUTH_TOKEN}`;
      
      const authRequest: UrbanBoltAuthRequestDto = {
        username: URBANBOLT_AUTH_CONFIG.USERNAME,
        password: URBANBOLT_AUTH_CONFIG.PASSWORD,
      };

      this.logger.log(`Authenticating with UrbanBolt API: ${authUrl}`);

      const response = await firstValueFrom(
        this.httpService.post<UrbanBoltAuthResponseDto>(authUrl, authRequest, {
          headers: {
            'Content-Type': 'application/json',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false, // Bypass SSL certificate verification for UAT environment
          }),
          timeout: 30000,
        }),
      );

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        
        // Set token expiry (subtract 5 minutes for safety)
        const expiryTime = new Date();
        expiryTime.setSeconds(expiryTime.getSeconds() + response.data.expires_in - 300);
        this.tokenExpiry = expiryTime;

        this.logger.log('UrbanBolt authentication successful');
        this.logger.debug(`Token expires at: ${this.tokenExpiry.toISOString()}`);
      } else {
        throw new Error('Invalid authentication response from UrbanBolt');
      }
    } catch (error) {
      this.logger.error('UrbanBolt authentication failed', error);
      this.accessToken = null;
      this.tokenExpiry = null;
      
      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        'UrbanBolt authentication failed',
        error,
      );
    }
  }

  async refreshToken(): Promise<string> {
    this.accessToken = null;
    this.tokenExpiry = null;
    return this.getAuthToken();
  }

  isTokenValid(): boolean {
    return this.accessToken !== null && 
           this.tokenExpiry !== null && 
           new Date() < this.tokenExpiry;
  }
}
