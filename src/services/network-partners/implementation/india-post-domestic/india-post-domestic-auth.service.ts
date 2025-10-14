import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import {
  INDIA_POST_DOMESTIC_BASE_URLS,
  INDIA_POST_DOMESTIC_ENDPOINTS,
  INDIA_POST_DOMESTIC_ENV_VARS,
} from "./india-post-domestic.enum";
import {
  IndiaPostDomesticLoginReqDto,
  IndiaPostDomesticLoginResDto,
  IndiaPostDomesticRefreshTokenResDto,
} from "./india-post-domestic.dto";

/**
 * India Post Domestic authentication provider
 * Implements the DoP Integration authentication flow for domestic services
 */
@Injectable()
export class IndiaPostDomesticAuthService implements AuthProvider {
  private readonly logger = new Logger(IndiaPostDomesticAuthService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  /**
   * Gets authentication headers for India Post Domestic APIs
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    this.logger.debug("Getting India Post Domestic authentication headers");

    const token = await this.getToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Gets a valid authentication token
   * Implements caching and automatic refresh
   */
  async getToken(): Promise<string | null> {
    this.logger.debug("Getting India Post Domestic authentication token");

    // Check if we have a valid cached token
    if (this.cachedToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      this.logger.debug("Using cached token");
      return this.cachedToken;
    }

    // Get new token
    try {
      const token = await this.login();
      return token;
    } catch (error) {
      this.logger.error(
        "Failed to get India Post Domestic token:",
        error.message
      );
      throw new Error(
        `India Post Domestic authentication failed: ${error.message}`
      );
    }
  }

  /**
   * Performs login with India Post Access Token API
   * Uses test.cept.gov.in/beextcustomer/v1/access/login as per new documentation
   */
  private async login(): Promise<string> {
    this.logger.debug("Performing India Post Domestic authentication");

    const authUrl = this.getAuthUrl();
    const username = this.configService.get<string>(
      INDIA_POST_DOMESTIC_ENV_VARS.USERNAME
    );
    const password = this.configService.get<string>(
      INDIA_POST_DOMESTIC_ENV_VARS.PASSWORD
    );

    if (!username || !password) {
      this.logger.error("Missing environment variables:", {
        username: !!username,
        password: !!password,
        authUrl: authUrl,
      });
      throw new Error(
        "India Post Domestic credentials not configured. Please set INDIA_POST_DOMESTIC_USERNAME and INDIA_POST_DOMESTIC_PASSWORD environment variables"
      );
    }

    // Use new Access Token endpoint format
    const loginData: IndiaPostDomesticLoginReqDto = {
      username: username,
      password: password,
    };

    this.logger.log("🔍 AUTHENTICATION DEBUG - Request details:", {
      username,
      authUrl,
      endpoint: `${authUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`,
      payload: loginData,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticLoginResDto>(
          `${authUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`,
          loginData,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

      const loginResponse = response.data;

      this.logger.log("🔍 AUTHENTICATION DEBUG - Response received:", {
        status: response.status,
        statusText: response.statusText,
        responseData: loginResponse ? "Response received" : "No response data",
      });

      // Log the full response for debugging
      this.logger.debug(
        "Access Token API Response:",
        loginResponse ? "Response received" : "No response"
      );

      // Check if login was successful
      if (!loginResponse.success) {
        throw new Error(
          `Authentication failed: ${loginResponse.message || "Unknown error"}`
        );
      }

      // Extract access token from nested data object
      const token = loginResponse.data?.access_token;
      if (!token) {
        this.logger.error(
          "No access token found in response. Available fields:",
          Object.keys(loginResponse || {})
        );
        throw new Error(
          `No access token received from India Post Access Token API. Response status: ${loginResponse?.success || "unknown"}`
        );
      }

      // Cache the token
      this.cachedToken = token;

      // Set expiry (token valid for the duration specified in response)
      const expiresInSeconds = loginResponse.data?.expires_in || 3600; // Default 60 minutes
      this.tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);

      this.logger.log(
        "Successfully authenticated with India Post Access Token API"
      );
      return this.cachedToken;
    } catch (error) {
      this.logger.error(
        "India Post Access Token authentication failed:",
        error.message
      );

      if (error.response) {
        this.logger.error("Response status:", error.response.status);
        this.logger.error("Response headers:", "Headers present");
        this.logger.error(
          "Response data:",
          error.response.data || "No response data"
        );
        this.logger.error("Request URL:", error.config?.url);
        this.logger.error(
          "Request payload:",
          error.config?.data || "No request payload"
        );
      } else if (error.request) {
        // Don't log the full request object as it contains circular references
        this.logger.error("No response received from server");
        this.logger.error(
          "Request URL:",
          `${this.getAuthUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`
        );
      } else {
        this.logger.error("Error setting up request:", error.message);
      }

      // Provide specific error messages based on status code
      if (error.response?.status === 401) {
        throw new Error(
          "Authentication failed: Invalid credentials. Please check username and password."
        );
      } else if (error.response?.status === 404) {
        throw new Error(
          `Authentication endpoint not found: ${this.getAuthUrl()}${INDIA_POST_DOMESTIC_ENDPOINTS.ACCESS_TOKEN}`
        );
      } else if (error.response?.status === 400) {
        throw new Error(
          `Bad request: ${error.response.data || "No response data"} - Please check the payload format.`
        );
      } else {
        throw new Error(
          `India Post Access Token authentication failed: ${error.message}`
        );
      }
    }
  }

  /**
   * Gets the authentication base URL
   */
  private getAuthUrl(): string {
    // Force test environment for now - commented out original for debugging
    // return INDIA_POST_DOMESTIC_BASE_URLS.TEST;

    // Original code - temporarily using test environment
    return (
      // this.configService.get<string>(INDIA_POST_DOMESTIC_ENV_VARS.BASE_URL) ||
      INDIA_POST_DOMESTIC_BASE_URLS.TEST
    );
  }

  /**
   * Refreshes the authentication token using new Refresh Token API
   * Uses test.cept.gov.in/beextcustomer/v1/access/TokenWithRtoken as per new documentation
   */
  async refreshToken(): Promise<string | null> {
    this.logger.debug("Refreshing India Post Domestic token");

    if (!this.cachedToken) {
      // No token to refresh, get a new one
      return this.getToken();
    }

    try {
      const authUrl = this.getAuthUrl();

      // Use form data for refresh token request
      const refreshData = new URLSearchParams({
        refreshToken: this.cachedToken,
      });

      const response = await firstValueFrom(
        this.httpService.post<IndiaPostDomesticRefreshTokenResDto>(
          `${authUrl}${INDIA_POST_DOMESTIC_ENDPOINTS.REFRESH_TOKEN}`,
          refreshData.toString(),
          {
            headers: {
              Authorization: `Bearer ${this.cachedToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        )
      );

      const refreshResponse = response.data;

      if (!refreshResponse.access_token) {
        throw new Error("No access token received from refresh API");
      }

      // Update cached token
      this.cachedToken = refreshResponse.access_token;

      // Update expiry
      const expiresInSeconds = refreshResponse.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);

      this.logger.log("Successfully refreshed India Post Domestic token");
      return this.cachedToken;
    } catch (error) {
      this.logger.error(
        "Token refresh failed, getting new token:",
        error.message
      );

      // Clear cached token and get new one
      this.cachedToken = null;
      this.tokenExpiry = null;

      return this.getToken();
    }
  }

  /**
   * Checks if the current token is valid
   */
  isTokenValid(): boolean {
    return (
      this.cachedToken !== null &&
      this.tokenExpiry !== null &&
      new Date() < this.tokenExpiry
    );
  }

  /**
   * Clears the cached token (useful for logout)
   */
  clearToken(): void {
    this.cachedToken = null;
    this.tokenExpiry = null;
    this.logger.debug("India Post Domestic token cache cleared");
  }

  /**
   * Test method to manually trigger authentication
   * Useful for debugging authentication issues
   */
  async testAuthentication(): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      this.logger.log("Testing India Post Domestic authentication...");
      const token = await this.getToken();

      if (token) {
        this.logger.log("Authentication test successful");
        return {
          success: true,
          token: token.substring(0, 20) + "...", // Show only first 20 chars for security
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
