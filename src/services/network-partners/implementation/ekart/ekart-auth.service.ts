import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import {
  EkartAuthRequestDto,
  EkartAuthResponseDto,
} from './ekart.dto';
import {
  EKART_ENV_KEYS,
  EKART_DEFAULTS,
  EKART_CONSTANTS,
} from './ekart-constants';

@Injectable()
export class EkartAuthService implements AuthProvider {
  private readonly logger = new Logger(EkartAuthService.name);
  private token: string | null = null;
  private tokenExpiryTime: number | null = null;
  private isTokenRefreshInProgress: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getToken(): Promise<string> {
    // Return cached token if valid
    if (this.token && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      this.logger.debug('Using cached Ekart token');
      return this.token;
    }

    // If token refresh is already in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      this.logger.debug('Ekart token refresh already in progress, waiting...');
      return this.isTokenRefreshInProgress;
    }

    // Start token refresh
    this.isTokenRefreshInProgress = this.refreshToken();

    try {
      const token = await this.isTokenRefreshInProgress;
      return token;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  private async refreshToken(): Promise<string> {
    try {
      this.logger.log('Refreshing Ekart auth token');

      const baseUrl = this.configService.get<string>(
        EKART_ENV_KEYS.BASE_URL,
        EKART_DEFAULTS.BASE_URL
      );
      const authPath = this.configService.get<string>(
        EKART_ENV_KEYS.AUTH_PATH,
        EKART_DEFAULTS.AUTH_PATH
      );
      
      const userName = this.configService.get<string>(
        EKART_ENV_KEYS.AUTH_USERNAME,
        ''
      );
      const password = this.configService.get<string>(
        EKART_ENV_KEYS.AUTH_PASSWORD,
        ''
      );

      if (!userName || !password) {
        throw new CustomHttpException(
          HttpStatus.BAD_REQUEST,
          'Ekart authentication credentials (userName and password) are required'
        );
      }

      const url = `${baseUrl}${authPath}`;
      const payload: EkartAuthRequestDto = {
        userName,
        password,
      };

      this.logger.debug(`Ekart authentication URL: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<EkartAuthResponseDto>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: EKART_CONSTANTS.DEFAULT_TIMEOUT
        })
      );

      // Token is in response.data.data field
      if (!response.data || !response.data.data) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          'Ekart authentication failed: Token not found in response.data'
        );
      }

      const token = response.data.data;
      this.token = token;
      
      // Set token expiry (JWT tokens typically expire in 24 hours)
      // We'll refresh it 5 minutes before expiry
      this.tokenExpiryTime = Date.now() + (24 * 60 * 60 * 1000) - EKART_CONSTANTS.TOKEN_EXPIRY_BUFFER;

      this.logger.log('Ekart authentication successful');
      this.logger.debug(`Token will be refreshed at: ${new Date(this.tokenExpiryTime).toISOString()}`);

      return token;
    } catch (error) {
      this.logger.error('Ekart authentication failed', error.stack);
      this.token = null;
      this.tokenExpiryTime = null;

      if (error instanceof CustomHttpException) {
        throw error;
      }

      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        `Ekart authentication failed: ${error.message}`
      );
    }
  }

  // Method to manually invalidate token
  invalidateToken(): void {
    this.logger.log('Invalidating Ekart token');
    this.token = null;
    this.tokenExpiryTime = null;
  }
}


