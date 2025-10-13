import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ShipCubeAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

@Injectable()
export class SHIPCUBEAuthService implements AuthProvider {
  private readonly logger = new Logger(SHIPCUBEAuthService.name);
  private readonly authUrl = this.configService.get<string>('SHIPCUBE_AUTH_URL');
  
  private currentToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshToken: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
    
  ) {}

  /**
   * Generate a new authentication token from ShipCube
   */
  async getToken(): Promise<string> {
    // Return cached token if it's still valid
    if (this.currentToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.currentToken;
    }

    // Try to refresh token if we have a refresh token
    if (this.refreshToken) {
      try {
        this.logger.debug('Attempting to refresh ShipCube token...');
        const newToken = await this.refreshAuthToken();
        return newToken;
      } catch (refreshError) {
        this.logger.warn('Token refresh failed, falling back to new authentication', refreshError.message);
      }
    }

    // Get new token with credentials
    return await this.getNewAuthToken();
  }

  /**
   * Get a new authentication token using username/password
   */
  private async getNewAuthToken(): Promise<string> {
    try {
      this.logger.debug('Requesting new ShipCube auth token with credentials...');

      const username = this.configService.get<string>('SHIPCUBE_USERNAME');
      const password = this.configService.get<string>('SHIPCUBE_PASSWORD');

      if (!username || !password) {
        throw new Error('ShipCube credentials not configured');
      }

      const body = { username, password };      
      const response:any = await firstValueFrom(
            this.httpService.post(this.authUrl, body, {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            })
      );

      // Store token and expiry
      this.currentToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      // Set expiry with 5-minute buffer
      const expiryTime = new Date();
      expiryTime.setSeconds(expiryTime.getSeconds() + response.data.expires_in - 300);
      this.tokenExpiry = expiryTime;

      this.logger.debug('Successfully obtained new ShipCube token');
      return this.currentToken;

    } catch (error) {
      this.logger.error('Failed to get ShipCube token', error.message);
      throw new Error(`ShipCube authentication failed: ${error.message}`);
    }
  }

  /**
   * Refresh authentication token using refresh token
   */
  private async refreshAuthToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.logger.debug('Refreshing ShipCube token...');

    const response:any = await firstValueFrom(
      this.httpService.post<ShipCubeAuthResponse>(this.authUrl, {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!response?.access_token) {
      throw new Error('No access token in refresh response');
    }

    // Update tokens
    this.currentToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token;
    
    // Set new expiry with buffer
    const expiryTime = new Date();
    expiryTime.setSeconds(expiryTime.getSeconds() + response.data.data.expires_in - 300);
    this.tokenExpiry = expiryTime;

    this.logger.debug('Successfully refreshed ShipCube token');
    return this.currentToken;
  }

  /**
   * Return headers with Bearer token for API calls
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Clear cached tokens (useful for testing or when credentials change)
   */
  clearTokens(): void {
    this.currentToken = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    this.logger.debug('ShipCube tokens cleared');
  }

  /**
   * Check if current token is valid
   */
  isTokenValid(): boolean {
    return !!(this.currentToken && this.tokenExpiry && new Date() < this.tokenExpiry);
  }

  /**
   * Get token expiry information for debugging
   */
  getTokenInfo(): { isValid: boolean; expiresIn?: number; hasRefreshToken: boolean } {
    const isValid = this.isTokenValid();
    let expiresIn: number | undefined;

    if (this.tokenExpiry) {
      expiresIn = Math.floor((this.tokenExpiry.getTime() - Date.now()) / 1000);
    }

    return {
      isValid,
      expiresIn,
      hasRefreshToken: !!this.refreshToken,
    };
  }
}