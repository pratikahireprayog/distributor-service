import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AuthProvider, TenantContext } from "../../interfaces/auth-provider.interface";
import {
  INDIA_POST_DOMESTIC_BASE_URLS,
  INDIA_POST_DOMESTIC_ENDPOINTS,
  INDIA_POST_DOMESTIC_ENV_VARS,
  INDIA_POST_DOMESTIC_CONFIG,
} from "./india-post-domestic.enum";
import {
  IndiaPostDomesticAccessTokenReqDto,
  IndiaPostDomesticAccessTokenResDto,
  IndiaPostDomesticRefreshTokenReqDto,
  IndiaPostDomesticRefreshTokenResDto,
} from "./india-post-domestic.dto";

/**
 * India Post Domestic authentication provider
 * Handles access token and refresh token management
 *
 * Features:
 * - Token caching with automatic expiry management
 * - Automatic token refresh when expired
 * - Fallback to new authentication if refresh fails
 * - Comprehensive error handling and logging
 */
@Injectable()
export class IndiaPostDomesticAuthService implements AuthProvider {
  private readonly logger = new Logger(IndiaPostDomesticAuthService.name);

  // Token cache
  private currentToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshToken: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  /**
   * Gets authentication headers for India Post Domestic API calls
   * Automatically handles token refresh if needed
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    this.logger.log("🔑 India Post Domestic: Getting authentication headers");

    const token = await this.getToken();

    this.logger.log(
      "✅ India Post Domestic: Authentication headers prepared successfully"
    );
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Gets a valid authentication token
   * Implements caching and automatic refresh logic
   */
  async getToken(): Promise<string> {
    this.logger.log("🎯 India Post Domestic: Getting authentication token");

    // Return cached token if it's still valid
    if (this.isTokenValid()) {
      this.logger.log(
        "📦 India Post Domestic: Using cached token (still valid)"
      );
      return this.currentToken!;
    }

    // Try to refresh token if we have a refresh token
    if (this.refreshToken) {
      try {
        this.logger.log(
          "🔄 India Post Domestic: Token expired, attempting refresh..."
        );
        const newToken = await this.refreshAuthToken();
        return newToken;
      } catch (refreshError) {
        this.logger.warn(
          "⚠️ India Post Domestic: Token refresh failed, getting new token:",
          refreshError.message
        );
        // Clear invalid refresh token
        this.refreshToken = null;
      }
    }

    // Get new token with credentials
    this.logger.log("🆕 India Post Domestic: Getting new access token...");
    return await this.getNewAccessToken();
  }

  /**
   * Get a new access token using credentials
   * Based on API Documentation Section 14.1.1
   */
  private async getNewAccessToken(): Promise<string> {
    try {
      this.logger.debug("Requesting new India Post Domestic access token...");

      const baseUrl = this.getBaseUrl();
      const username = this.configService.get<string>(
        INDIA_POST_DOMESTIC_ENV_VARS.USERNAME
      );
      const password = this.configService.get<string>(
        INDIA_POST_DOMESTIC_ENV_VARS.PASSWORD
      );

      if (!username || !password) {
        throw new Error(
          "India Post Domestic credentials not configured. Please set INDIA_POST_DOMESTIC_USERNAME and INDIA_POST_DOMESTIC_PASSWORD environment variables"
        );
      }

      // Prepare request payload as per API documentation
      const requestPayload: IndiaPostDomesticAccessTokenReqDto = {
        username: username,
        password: password,
      };

      this.logger.debug(
        "Making access token request to:",
        `${baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`
      );

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticAccessTokenResDto>(
          `${baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`,
          requestPayload,
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
          }
        )
      );

      const tokenResponse = response.data;

      // Validate response structure as per API documentation
      if (!tokenResponse.success) {
        throw new Error(
          `Authentication failed: ${tokenResponse.message || "Login unsuccessful"}`
        );
      }

      if (!tokenResponse.data || !tokenResponse.data.access_token) {
        throw new Error(
          "No access token received from India Post Domestic API"
        );
      }

      // Cache the tokens
      this.currentToken = tokenResponse.data.access_token;
      this.refreshToken = tokenResponse.data.refresh_token;

      // Set expiry with buffer
      const expirySeconds =
        tokenResponse.data.expires_in ||
        INDIA_POST_DOMESTIC_CONFIG.DEFAULT_TOKEN_EXPIRY_SECONDS;
      const expiryTime = new Date();
      expiryTime.setSeconds(
        expiryTime.getSeconds() +
          expirySeconds -
          INDIA_POST_DOMESTIC_CONFIG.TOKEN_EXPIRY_BUFFER_SECONDS
      );
      this.tokenExpiry = expiryTime;

      this.logger.log(
        "Successfully obtained new India Post Domestic access token"
      );
      this.logger.debug(`Token expires at: ${this.tokenExpiry.toISOString()}`);
      this.logger.log(
        `🎫 Token preview (first 20 chars): ${this.currentToken.substring(0, 20)}...`
      );

      return this.currentToken;
    } catch (error) {
      this.logger.error(
        "Failed to get India Post Domestic access token:",
        error.message
      );

      // Enhanced error handling
      if (error.response) {
        this.logger.error("Response status:", error.response.status);
        this.logger.error(
          "Response headers:",
          error.response.headers ? "Headers present" : "No headers"
        );

        // Log response data safely
        try {
          this.logger.error(
            "Response data:",
            JSON.stringify(error.response.data, null, 2)
          );
        } catch (jsonError) {
          this.logger.error(
            "Response data:",
            error.response.data
              ? "Data present but not JSON serializable"
              : "No response data"
          );
        }

        // Log request details for debugging
        if (error.config) {
          this.logger.error("Request URL:", error.config.url);
          this.logger.error("Request method:", error.config.method);
          this.logger.error(
            "Request headers:",
            error.config.headers ? "Headers present" : "No headers"
          );

          // Log request payload safely
          try {
            this.logger.error(
              "Request payload:",
              JSON.stringify(error.config.data, null, 2)
            );
          } catch (jsonError) {
            this.logger.error(
              "Request payload:",
              error.config.data
                ? "Data present but not JSON serializable"
                : "No request data"
            );
          }
        }

        if (error.response.status === 401) {
          throw new Error(
            "Authentication failed: Invalid credentials. Please check INDIA_POST_DOMESTIC_USERNAME and INDIA_POST_DOMESTIC_PASSWORD"
          );
        } else if (error.response.status === 400) {
          throw new Error(
            `Bad request: Please check the authentication payload format. Server response: ${error.response.data?.message || "No message"}`
          );
        }
      }

      throw new Error(
        `India Post Domestic authentication failed: ${error.message}`
      );
    }
  }

  /**
   * Refresh authentication token using refresh token
   * Based on API Documentation Section 14.1.2
   */
  private async refreshAuthToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      this.logger.debug("Refreshing India Post Domestic token...");

      const baseUrl = this.getBaseUrl();

      // Prepare refresh request as per API documentation
      // The refresh token is sent as Bearer token in Authorization header
      // AND also as form-urlencoded in body
      const refreshPayload = new URLSearchParams({
        refreshToken: this.refreshToken,
      });

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticRefreshTokenResDto>(
          `${baseUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.REFRESH_TOKEN}`,
          refreshPayload.toString(),
          {
            headers: {
              Authorization: `Bearer ${this.refreshToken}`, // Refresh token as Bearer token
              "Content-Type": "application/x-www-form-urlencoded", // Form-urlencoded as per API docs
            },
            timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
          }
        )
      );

      const tokenData = response.data;

      if (!tokenData.access_token) {
        throw new Error("No access token in refresh response");
      }

      // Update tokens
      this.currentToken = tokenData.access_token;
      // Note: Refresh token API doesn't return new refresh token, so keep existing one

      // Set new expiry with buffer
      const expirySeconds =
        tokenData.expires_in ||
        INDIA_POST_DOMESTIC_CONFIG.DEFAULT_TOKEN_EXPIRY_SECONDS;
      const expiryTime = new Date();
      expiryTime.setSeconds(
        expiryTime.getSeconds() +
          expirySeconds -
          INDIA_POST_DOMESTIC_CONFIG.TOKEN_EXPIRY_BUFFER_SECONDS
      );
      this.tokenExpiry = expiryTime;

      this.logger.log("Successfully refreshed India Post Domestic token");
      this.logger.log(
        `🎫 Refreshed token preview (first 20 chars): ${this.currentToken.substring(0, 20)}...`
      );
      return this.currentToken;
    } catch (error) {
      this.logger.error("Token refresh failed:", error.message);
      throw error;
    }
  }

  /**
   * Get the base URL for API calls
   */
  private getBaseUrl(): string {
    return (
      this.configService.get<string>(INDIA_POST_DOMESTIC_ENV_VARS.BASE_URL) ||
      INDIA_POST_DOMESTIC_BASE_URLS.TEST
    );
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    return !!(
      this.currentToken &&
      this.tokenExpiry &&
      new Date() < this.tokenExpiry
    );
  }

  /**
   * Clear cached tokens (useful for testing or when credentials change)
   */
  clearTokens(): void {
    this.currentToken = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    this.logger.debug("India Post Domestic tokens cleared");
  }

  /**
   * Get token information for debugging
   */
  getTokenInfo(): {
    isValid: boolean;
    expiresIn?: number;
    hasRefreshToken: boolean;
    expiresAt?: string;
  } {
    const isValid = this.isTokenValid();
    let expiresIn: number | undefined;
    let expiresAt: string | undefined;

    if (this.tokenExpiry) {
      expiresIn = Math.floor((this.tokenExpiry.getTime() - Date.now()) / 1000);
      expiresAt = this.tokenExpiry.toISOString();
    }

    return {
      isValid,
      expiresIn,
      expiresAt,
      hasRefreshToken: !!this.refreshToken,
    };
  }

  /**
   * Test method to manually trigger authentication
   * Useful for debugging authentication issues
   */
  async testAuthentication(): Promise<{
    success: boolean;
    tokenInfo?: any;
    error?: string;
  }> {
    try {
      this.logger.log("Testing India Post Domestic authentication...");
      const token = await this.getToken();

      if (token) {
        const tokenInfo = this.getTokenInfo();
        this.logger.log("Authentication test successful");
        return {
          success: true,
          tokenInfo: {
            ...tokenInfo,
            tokenPreview: token.substring(0, 20) + "...", // Show only first 20 chars for security
          },
        };
      } else {
        this.logger.error("Authentication test failed: No token received");
        return { success: false, error: "No token received" };
      }
    } catch (error) {
      this.logger.error("Authentication test failed:", error.message);
      return { success: false, error: error.message };
    }
  }
}
