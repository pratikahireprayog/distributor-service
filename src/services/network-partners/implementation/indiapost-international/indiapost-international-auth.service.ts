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
    this.logger.log('[IndiaPost International Auth] Getting authentication headers');
    const token = await this.getToken();
    const tokenPreview = token ? `${token.substring(0, 20)}...` : 'MISSING';
    this.logger.log(`[IndiaPost International Auth] Token retrieved - Preview: ${tokenPreview}, Length: ${token?.length || 0}`);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async getToken(): Promise<string> {
    const now = new Date();
    
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && now < this.tokenExpiry) {
      const timeUntilExpiry = Math.floor((this.tokenExpiry.getTime() - now.getTime()) / 1000);
      this.logger.log(`[IndiaPost International Auth] Using cached access token - Expires in: ${timeUntilExpiry}s`);
      return this.accessToken;
    }

    if (this.accessToken && this.tokenExpiry) {
      const expiredBy = Math.floor((now.getTime() - this.tokenExpiry.getTime()) / 1000);
      this.logger.warn(`[IndiaPost International Auth] Token expired - Expired by: ${expiredBy}s`);
    } else if (!this.accessToken) {
      this.logger.log(`[IndiaPost International Auth] No cached token available`);
    }

    // If a refresh is already in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      this.logger.log('[IndiaPost International Auth] Token refresh already in progress, waiting...');
      await this.isTokenRefreshInProgress;
      this.logger.log('[IndiaPost International Auth] Token refresh completed, using new token');
      return this.accessToken!;
    }

    // Start token refresh
    this.logger.log('[IndiaPost International Auth] Starting new token authentication');
    this.isTokenRefreshInProgress = this.authenticate();

    try {
      await this.isTokenRefreshInProgress;
      return this.accessToken!;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  private async authenticate(): Promise<void> {
    const authStartTime = Date.now();
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

      this.logger.log(`[IndiaPost International Auth] Starting authentication`);
      this.logger.log(`[IndiaPost International Auth] Auth URL: ${url}`);
      this.logger.log(`[IndiaPost International Auth] Username: ${username}`);
      this.logger.log(`[IndiaPost International Auth] Request payload: ${JSON.stringify({ username }, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostInternationalAuthResponseDto>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: INDIAPOST_INTERNATIONAL_CONSTANTS.DEFAULT_TIMEOUT,
        })
      );

      const authDuration = Date.now() - authStartTime;
      this.logger.log(`[IndiaPost International Auth] Authentication response received - Status: ${response.status}, Duration: ${authDuration}ms`);
      this.logger.log(`[IndiaPost International Auth] Response data: ${JSON.stringify({
        success: response.data?.success,
        message: response.data?.message,
        hasAccessToken: !!response.data?.data?.access_token,
        expiresIn: response.data?.data?.expires_in,
      }, null, 2)}`);

      // Extract token from response.data.data.access_token
      const token = response.data?.data?.access_token;
      const expiresIn = response.data?.data?.expires_in || 10800; // Default 3 hours

      if (!token || typeof token !== 'string') {
        this.logger.error(`[IndiaPost International Auth] Failed to extract token from response`);
        this.logger.error(`[IndiaPost International Auth] Full response: ${JSON.stringify(response.data, null, 2)}`);
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          `Failed to retrieve access token from IndiaPost International. Response: ${JSON.stringify(response.data)}`
        );
      }

      this.accessToken = token;
      const tokenPreview = `${token.substring(0, 20)}...`;
      this.logger.log(`[IndiaPost International Auth] Token extracted - Preview: ${tokenPreview}, Length: ${token.length}`);

      // Set token expiry with buffer
      const expirySeconds = expiresIn - INDIAPOST_INTERNATIONAL_CONSTANTS.TOKEN_REFRESH_BUFFER_SECONDS;
      this.tokenExpiry = new Date(Date.now() + expirySeconds * 1000);

      this.logger.log(`[IndiaPost International Auth] Authentication successful`);
      this.logger.log(`[IndiaPost International Auth] Token expires at: ${this.tokenExpiry.toISOString()}`);
      this.logger.log(`[IndiaPost International Auth] Token valid for: ${expirySeconds}s (${Math.floor(expirySeconds / 60)} minutes)`);
      this.logger.log(`[IndiaPost International Auth] Total authentication time: ${Date.now() - authStartTime}ms`);
    } catch (error) {
      const authDuration = Date.now() - authStartTime;
      this.logger.error(`[IndiaPost International Auth] Authentication failed - Duration: ${authDuration}ms`);
      this.logger.error(`[IndiaPost International Auth] Error message: ${error.message}`);
      this.logger.error(`[IndiaPost International Auth] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[IndiaPost International Auth] Error response status: ${error.response.status}`);
        this.logger.error(`[IndiaPost International Auth] Error response data: ${JSON.stringify(error.response.data, null, 2)}`);
        this.logger.error(`[IndiaPost International Auth] Error response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      
      if (error.request) {
        this.logger.error(`[IndiaPost International Auth] Request config: ${JSON.stringify({
          url: error.config?.url,
          method: error.config?.method,
        }, null, 2)}`);
      }

      // Clear token on error
      this.accessToken = null;
      this.tokenExpiry = null;
      this.logger.error(`[IndiaPost International Auth] Cleared cached token due to error`);

      throw new CustomHttpException(
        HttpStatus.UNAUTHORIZED,
        `IndiaPost International authentication failed: ${error.message}`
      );
    }
  }

  // Method to force token refresh
  async refreshToken(): Promise<void> {
    const refreshStartTime = Date.now();
    this.logger.log(`[IndiaPost International Auth] Forcing token refresh`);
    this.logger.log(`[IndiaPost International Auth] Current token status - HasToken: ${!!this.accessToken}, Expiry: ${this.tokenExpiry?.toISOString() || 'N/A'}`);
    
    this.accessToken = null;
    this.tokenExpiry = null;
    
    this.logger.log(`[IndiaPost International Auth] Cleared existing token, starting new authentication`);
    await this.authenticate();
    
    const refreshDuration = Date.now() - refreshStartTime;
    this.logger.log(`[IndiaPost International Auth] Token refresh completed - Duration: ${refreshDuration}ms`);
  }
}




