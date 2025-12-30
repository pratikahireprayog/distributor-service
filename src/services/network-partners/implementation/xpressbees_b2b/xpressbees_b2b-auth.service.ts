import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AuthProvider, TenantContext } from '../../interfaces/auth-provider.interface';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';
import {
  XpressbeesB2bAuthRequestDto,
  XpressbeesB2bAuthResponseDto,
} from './xpressbees_b2b.dto';
import {
  XPRESSBEES_B2B_ENV_KEYS,
  XPRESSBEES_B2B_DEFAULTS,
  XPRESSBEES_B2B_CONSTANTS,
} from './xpressbees_b2b-constants';

@Injectable()
export class XpressbeesB2bAuthService implements AuthProvider {
  private readonly logger = new Logger(XpressbeesB2bAuthService.name);
  private token: string | null = null;
  private tokenExpiryTime: number | null = null;
  private isTokenRefreshInProgress: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getToken(): Promise<string> {
    // Return cached token if valid
    if (this.token && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      this.logger.debug('Using cached token');
      return this.token;
    }

    // If token refresh is already in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      this.logger.debug('Token refresh already in progress, waiting...');
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
      this.logger.log('Refreshing XpressBees B2B auth token');

      const baseUrl = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.BASE_URL,
        XPRESSBEES_B2B_DEFAULTS.BASE_URL
      );
      const authPath = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.AUTH_PATH,
        XPRESSBEES_B2B_DEFAULTS.AUTH_PATH
      );
      
      // Hardcoded credentials as fallback (for development only) - same as B2C
      const email = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.AUTH_EMAIL,
        'mukesh@cargodham.com'
      );
      const password = this.configService.get<string>(
        XPRESSBEES_B2B_ENV_KEYS.AUTH_PASSWORD,
        'Mukesh@3724'
      );

      const url = `${baseUrl}${authPath}`;
      const payload: XpressbeesB2bAuthRequestDto = {
        email,
        password,
      };

      this.logger.debug(`Authentication URL: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<XpressbeesB2bAuthResponseDto>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: XPRESSBEES_B2B_CONSTANTS.DEFAULT_TIMEOUT
        })
      );

      if (!response.data || !response.data.status || !response.data.data) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          'XpressBees B2B authentication failed: Invalid response'
        );
      }

      const token = response.data.data;
      this.token = token;
      
      // Set token expiry (JWT tokens from XpressBees typically expire in 3 hours)
      // We'll refresh it 5 minutes before expiry
      this.tokenExpiryTime = Date.now() + (3 * 60 * 60 * 1000) - XPRESSBEES_B2B_CONSTANTS.TOKEN_EXPIRY_BUFFER;

      this.logger.log('XpressBees B2B authentication successful');
      this.logger.debug(`Token will be refreshed at: ${new Date(this.tokenExpiryTime).toISOString()}`);

      return token;
    } catch (error) {
      this.logger.error('XpressBees B2B authentication failed', error.stack);
      this.token = null;
      this.tokenExpiryTime = null;

      if (error instanceof CustomHttpException) {
        throw error;
      }

      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        `XpressBees B2B authentication failed: ${error.message}`
      );
    }
  }

  // Method to manually invalidate token
  invalidateToken(): void {
    this.logger.log('Invalidating XpressBees B2B token');
    this.token = null;
    this.tokenExpiryTime = null;
  }
}

