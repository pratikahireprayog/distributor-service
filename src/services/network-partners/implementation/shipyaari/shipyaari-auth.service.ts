import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
} from "src/common/enums/global.enum";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import {
  NetworkPartnerRequestBuilder,
  NetworkPartnerRequest,
} from "src/services/network-partners/base/network-partner-request-builder";
import { lastValueFrom } from "rxjs";

interface TokenData {
  token: string;
  expiresAt: number;
}

interface ShipyaariAuthResponse {
  success: boolean;
  status?: boolean;
  token?: string;
  message?: string;
  data?: any[];
}

interface ShipyaariV2AuthResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: Array<{
    name: string;
    email: string;
    sellerId: number;
    companyId: string;
    privateCompanyId: number;
    token: string;
    jwt: string;
    privateCompany: {
      name: string;
      companyId: number;
      address: string;
      pincode: number;
      city: string;
      state: string;
      logoUrl: string;
      brandName: string;
      businessType: string;
      webSite: string;
      facebookUrl: string;
      instagramUrl: string;
      whatsappUrl: string;
      accountDetails: any[];
      operationDetails: any[];
    };
    nextStep: {
      qna: boolean;
      kyc: boolean;
      bank: boolean;
      isChannelIntegrated: boolean;
    };
    contactNumber: number;
    isWalletRechage: boolean;
    isReturningUser: boolean;
    isMigrated: boolean;
    phpUserId: number;
    phpParentId: number;
    businessType: string;
    kycDetails: {
      gstNumber: string;
      gstVerified: boolean;
      gstFile: string;
      panNumber: string;
      panVerified: boolean;
      panFile: string;
      aadharNumber: number;
      aadharVerified: boolean;
      aadharFile: string;
      address: {
        plotNumber: string;
        locality: string;
        city: string;
        district: string;
        pincode: number;
        state: string;
        country: string;
      };
      fullAddress: string;
      isKYCDone: boolean;
      fullName: string;
    };
    isPostpaid: boolean;
    isMaskedUser: boolean;
    isWalletBlackListed: boolean;
  }>;
}

// Custom error class for authentication errors
class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly responseData?: any
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

@Injectable()
export class ShipyaariAuthService implements AuthProvider {
  private readonly logger = new Logger(ShipyaariAuthService.name);
  private tokenData: TokenData | null = null;
  private isTokenRefreshInProgress: Promise<TokenData> | null = null;
  private readonly requestBuilder: NetworkPartnerRequestBuilder;

  // Token validity buffer (5 minutes before actual expiry)
  private readonly TOKEN_VALIDITY_BUFFER = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly endpointConfigRepository: EndpointConfigRepository
  ) {
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
        throw new AuthenticationError(
          "Auth endpoint configuration not found for Shipyaari"
        );
      }

      const { email, password, client_id } = endpointConfig.credentials;

      if (!email || !password) {
        throw new AuthenticationError(
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

      // Execute request using the NestJS HttpService directly
      const response =
        await this.executeRequest<ShipyaariAuthResponse>(request);
      const { data } = response;

      this.logger.debug(`Auth response: ${JSON.stringify(data)}`);

      // Check for token in multiple possible places according to Shipyaari's response structure
      let token = "";

      // Check if token is directly in the response
      if (data.token) {
        token = data.token;
      }
      // Check if token is in the data array
      else if (
        data.data &&
        Array.isArray(data.data) &&
        data.data.length > 0 &&
        data.data[0].token
      ) {
        token = data.data[0].token;
      }

      if (!token) {
        // Throw custom error with structured data for better error handling
        throw new AuthenticationError("Token not found in response", data);
      }

      // Calculate token expiry (23 hours from now)
      const expiresAt = Date.now() + 23 * 60 * 60 * 1000;

      const tokenData: TokenData = {
        token,
        expiresAt,
      };

      this.logger.debug("Successfully refreshed Shipyaari auth token");
      return tokenData;
    } catch (error) {
      // If it's our custom error, log it properly
      if (error instanceof AuthenticationError) {
        this.logger.error(
          `Failed to refresh Shipyaari auth token: ${error.message}`,
          error.responseData ? JSON.stringify(error.responseData) : ""
        );
      } else {
        this.logger.error(
          `Failed to refresh Shipyaari auth token: ${error.message}`,
          error.stack
        );
      }
      throw error;
    }
  }

  /**
   * Execute an HTTP request using NestJS HttpService
   * @param request The request configuration
   * @returns The response data
   */
  private async executeRequest<T>(
    request: NetworkPartnerRequest
  ): Promise<{ data: T }> {
    const { url, method, headers, data, params } = request;

    const observable = this.httpService.request({
      url,
      method,
      headers,
      data,
      params,
    });

    return await lastValueFrom(observable);
  }

  /**
   * Force refresh the token regardless of current validity
   * Useful when current token is rejected by the API
   */
  async forceRefreshToken(): Promise<void> {
    this.tokenData = null;
    await this.getValidToken();
  }

   async getAuthHeadersV2(): Promise<Record<string, string>> {
    try {
      // Get credentials from environment variables
      const email = this.configService.get<string>("SHIPYAARI_EMAIL");
      const password = this.configService.get<string>("SHIPYAARI_PASSWORD");

      if (!email || !password) {
        throw new AuthenticationError(
          "Shipyaari authentication credentials are missing in environment variables (SHIPYAARI_EMAIL, SHIPYAARI_PASSWORD)"
        );
      }

      // Build request for signIn API
      const request = this.requestBuilder
        .reset()
        .setUrl(this.configService.get<string>("SHIPYAARI_LOGIN_URL") || "https://api-seller.shipyaari.com/api/v1/seller/signIn")
        .setMethod("POST")
        .setHeaders({
          "Content-Type": "application/json",
        })
        .setData({
          email,
          password,
        })
        .build();

      // Execute request using the NestJS HttpService directly
      const response = await this.executeRequest<ShipyaariV2AuthResponse>(request);
      const { data } = response;

      this.logger.debug(`Auth response: ${JSON.stringify(data)}`);

      // Check for token in the response structure
      let token = "";

      if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
        token = data.data[0].token || data.data[0].jwt;
      }

      if (!token) {
        // Throw custom error with structured data for better error handling
        throw new AuthenticationError("Token not found in response", data);
      }

      this.logger.debug("Successfully obtained Shipyaari auth token");
      
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    } catch (error) {
      // If it's our custom error, log it properly
      if (error instanceof AuthenticationError) {
        this.logger.error(
          `Failed to get Shipyaari auth token: ${error.message}`,
          error.responseData ? JSON.stringify(error.responseData) : ""
        );
      } else {
        this.logger.error(
          `Failed to get Shipyaari auth token: ${error.message}`,
          error.stack
        );
      }
      throw error;
    }
  }
}
