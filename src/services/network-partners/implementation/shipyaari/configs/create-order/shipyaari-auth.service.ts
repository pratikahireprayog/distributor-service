import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AuthProvider } from "../../../../interfaces/auth-provider.interface";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
} from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import { NetworkPartnerHttpClient } from "../../../../base/network-partner-http-client";
import { NetworkPartnerRequestBuilder } from "../../../../base/network-partner-request-builder";

interface TokenData {
  token: string;
  expiresAt: number;
}

interface ShipyaariAuthResponse {
  status: boolean;
  token: string;
  message?: string;
}

@Injectable()
export class ShipyaariAuthService implements AuthProvider {
  private readonly logger = new Logger(ShipyaariAuthService.name);
  private tokenData: TokenData | null = null;
  private isTokenRefreshInProgress: Promise<TokenData> | null = null;
  private readonly httpClient: NetworkPartnerHttpClient;
  private readonly requestBuilder: NetworkPartnerRequestBuilder;

  // Token validity buffer (5 minutes before actual expiry)
  private readonly TOKEN_VALIDITY_BUFFER = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly endpointConfigRepository: EndpointConfigRepository
  ) {
    this.httpClient = new NetworkPartnerHttpClient(httpService);
    this.requestBuilder = new NetworkPartnerRequestBuilder();
  }

  /**
   * Get authentication headers for API requests
   * Implements the AuthProvider interface
   * @returns Headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const tokenData = await this.getValidToken();
    return {
      Authorization: `Bearer ${tokenData.token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get a valid token, refreshing if necessary
   * @returns Valid token data
   */
  private async getValidToken(): Promise<TokenData> {
    // Check if we have a valid token that's not close to expiry
    if (this.isTokenValid()) {
      return this.tokenData!;
    }

    // If refresh is in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      return this.isTokenRefreshInProgress;
    }

    // Start token refresh process
    this.isTokenRefreshInProgress = this.refreshToken();
    try {
      const newTokenData = await this.isTokenRefreshInProgress;
      this.tokenData = newTokenData;
      return newTokenData;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  /**
   * Check if current token is valid and not close to expiry
   * @returns boolean indicating if token is valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenData) return false;

    // Check if token exists and is valid with buffer time
    const currentTime = Date.now();
    return (
      this.tokenData.token &&
      this.tokenData.expiresAt > currentTime + this.TOKEN_VALIDITY_BUFFER
    );
  }

  /**
   * Refresh the authentication token
   * @returns New token data
   */
  private async refreshToken(): Promise<TokenData> {
    try {
      const endpointConfig = await this.endpointConfigRepository.getOne({
        partnerCode: PARTNER_CODE_ENUM.SHIPYAARI,
        endpointId: ENDPOINT_ID_ENUM.AUTH_TOKEN,
      });

      if (!endpointConfig || !endpointConfig.credentials) {
        throw new Error("Auth endpoint configuration not found for Shipyaari");
      }

      const { email, password, client_id } = endpointConfig.credentials;

      if (!email || !password) {
        throw new Error(
          "Shipyaari authentication credentials are missing in endpoint configuration"
        );
      }

      // Build request using the request builder
      const request = this.requestBuilder
        .reset()
        .setUrl(endpointConfig.url)
        .setMethod(endpointConfig.method)
        .setHeaders({
          "Content-Type": endpointConfig.contentType || "application/json",
        })
        .setData({
          email,
          password,
          ...(client_id ? { client_id } : {}),
        })
        .build();

      // Execute request using the HTTP client
      const response =
        await this.httpClient.execute<ShipyaariAuthResponse>(request);

      if (!response.status || !response.token) {
        throw new Error(
          `Token refresh failed: ${response.message || "Unknown error"}`
        );
      }

      // Calculate token expiry (23 hours from now)
      const expiresAt = Date.now() + 23 * 60 * 60 * 1000;

      const tokenData: TokenData = {
        token: response.token,
        expiresAt,
      };

      this.logger.debug("Successfully refreshed Shipyaari auth token");
      return tokenData;
    } catch (error) {
      this.logger.error(
        `Failed to refresh Shipyaari auth token: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Force refresh the token regardless of current validity
   * Useful when current token is rejected by the API
   */
  async forceRefreshToken(): Promise<void> {
    this.tokenData = null;
    await this.getValidToken();
  }
}
