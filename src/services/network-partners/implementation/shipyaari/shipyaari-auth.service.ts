import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import {
  NetworkPartnerRequestBuilder,
  NetworkPartnerRequest,
} from "src/services/network-partners/base/network-partner-request-builder";
import { lastValueFrom } from "rxjs";

interface ShipyaariAuthResponse {
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
  private readonly requestBuilder: NetworkPartnerRequestBuilder;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.requestBuilder = new NetworkPartnerRequestBuilder();
  }

  /**
   * Get authentication headers for API requests
   * Implements the AuthProvider interface
   * @returns Headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
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
      const response = await this.executeRequest<ShipyaariAuthResponse>(request);
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
}
