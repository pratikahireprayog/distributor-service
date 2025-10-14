import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import { XPRESSBEES_ENV_KEYS, XPRESSBEES_DEFAULTS, XPRESSBEES_CONSTANTS } from './xpressbees-constants';
import { XpressbeesAuthRequestDto, XpressbeesAuthResponseDto } from './xpressbees.dto';

@Injectable()
export class XpressbeesAuthService implements AuthProvider {
  private readonly logger = new Logger(XpressbeesAuthService.name);
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private isTokenRefreshInProgress: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getToken(): Promise<string> {
    // If token refresh is in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      return this.isTokenRefreshInProgress;
    }

    // Check if we have a valid cached token
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
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
      const baseUrl = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.BASE_URL,
        XPRESSBEES_DEFAULTS.BASE_URL
      );
      const authPath = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.AUTH_PATH,
        XPRESSBEES_DEFAULTS.AUTH_PATH
      );
      const email = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.EMAIL,
        XPRESSBEES_DEFAULTS.EMAIL
      );
      const password = this.configService.get<string>(
        XPRESSBEES_ENV_KEYS.PASSWORD,
        XPRESSBEES_DEFAULTS.PASSWORD
      );

      const url = `${baseUrl}${authPath}`;

      const payload: XpressbeesAuthRequestDto = {
        email,
        password,
      };

      this.logger.log(`Authenticating with Xpressbees: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesAuthResponseDto>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: XPRESSBEES_CONSTANTS.DEFAULT_TIMEOUT,
        })
      );

      // Token is directly in data field as a string
      const token = response.data?.data;
      const expiresIn = 10800; // Default 3 hours

      if (!token || typeof token !== 'string') {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          `Failed to retrieve access token from Xpressbees. Response: ${JSON.stringify(response.data)}`
        );
      }

      this.token = token;
      // Set expiry with buffer
      const expirySeconds = expiresIn - XPRESSBEES_CONSTANTS.TOKEN_REFRESH_BUFFER_SECONDS;
      this.tokenExpiry = new Date(Date.now() + expirySeconds * 1000);

      this.logger.log(`Xpressbees authentication successful. Token expires at: ${this.tokenExpiry}`);

      return token;
    } catch (error) {
      this.logger.error(`Xpressbees authentication failed: ${error.message}`, error.stack);
      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        `Xpressbees authentication failed: ${error.message}`
      );
    }
  }
}
