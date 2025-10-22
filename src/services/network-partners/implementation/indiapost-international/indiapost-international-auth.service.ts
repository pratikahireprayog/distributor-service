import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import {
  IndiaPostInternationalAuthRequestDto,
  IndiaPostInternationalAuthResponseDto,
} from './indiapost-international.dto';
import {
  INDIAPOST_INTERNATIONAL_ENV_KEYS,
  INDIAPOST_INTERNATIONAL_DEFAULTS,
  INDIAPOST_INTERNATIONAL_CONSTANTS,
} from './indiapost-international-constants';

@Injectable()
export class IndiaPostInternationalAuthService implements AuthProvider {
  private readonly logger = new Logger(IndiaPostInternationalAuthService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private isTokenRefreshInProgress: Promise<void> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async getToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      this.logger.debug('Using cached access token');
      return this.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      this.logger.debug('Token refresh already in progress, waiting...');
      await this.isTokenRefreshInProgress;
      return this.accessToken!;
    }

    // Start token refresh
    this.isTokenRefreshInProgress = this.authenticate();

    try {
      await this.isTokenRefreshInProgress;
      return this.accessToken!;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const baseUrl = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.BASE_URL,
        INDIAPOST_INTERNATIONAL_DEFAULTS.BASE_URL
      );
      const authPath = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.AUTH_PATH,
        INDIAPOST_INTERNATIONAL_DEFAULTS.AUTH_PATH
      );
      const username = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.USERNAME,
        INDIAPOST_INTERNATIONAL_DEFAULTS.USERNAME
      );
      const password = this.configService.get<string>(
        INDIAPOST_INTERNATIONAL_ENV_KEYS.PASSWORD,
        INDIAPOST_INTERNATIONAL_DEFAULTS.PASSWORD
      );

      const url = `${baseUrl}${authPath}`;
      const payload: IndiaPostInternationalAuthRequestDto = {
        username,
        password,
      };

      this.logger.log(`Authenticating with IndiaPost International: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalAuthResponseDto>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
        })
      );

      // Extract token from response.data.data.access_token
      const token = response.data?.data?.access_token;
      const expiresIn = response.data?.data?.expires_in || 10800; // Default 3 hours

      if (!token || typeof token !== 'string') {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          `Failed to retrieve access token from IndiaPost International. Response: ${JSON.stringify(response.data)}`
        );
      }

      this.accessToken = token;

      // Set token expiry with buffer
      const expirySeconds = expiresIn - INDIAPOST_INTERNATIONAL_CONSTANTS.TOKEN_REFRESH_BUFFER_SECONDS;
      this.tokenExpiry = new Date(Date.now() + expirySeconds * 1000);

      this.logger.log(
        `Successfully authenticated with IndiaPost International. Token expires at ${this.tokenExpiry.toISOString()}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to authenticate with IndiaPost International: ${error.message}`,
        error.stack
      );

      // Clear token on error
      this.accessToken = null;
      this.tokenExpiry = null;

      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        `IndiaPost International authentication failed: ${error.message}`
      );
    }
  }

  // Method to force token refresh
  async refreshToken(): Promise<void> {
    this.logger.log('Forcing token refresh for IndiaPost International');
    this.accessToken = null;
    this.tokenExpiry = null;
    await this.authenticate();
  }
}




