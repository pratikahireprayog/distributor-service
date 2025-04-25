import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import { SHIPYAARI_ENV_VARS } from "./shipyaari.enum";
import { ShipyaariAuthReqDto, ShipyaariAuthResDto } from "./shipyaari.dto";
import { EndpointConfigRepository } from "src/common/repositories/endpoint-configs/endpoint-configs.repository";
import {
  PARTNER_CODE_ENUM,
  ENDPOINT_ID_ENUM,
} from "src/common/enums/global.enum";

@Injectable()
export class ShipyaariAuthService implements AuthProvider {
  private readonly logger = new Logger(ShipyaariAuthService.name);
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private isTokenRefreshInProgress: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly endpointConfigRepository: EndpointConfigRepository
  ) {}

  /**
   * Get authentication headers for API requests
   * Implements the AuthProvider interface
   * @returns Headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get authentication token
   * @returns Valid authentication token
   */
  private async getToken(): Promise<string> {
    // Check if token exists and is valid
    if (this.token && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.token;
    }

    // If token refresh is already in progress, wait for it
    if (this.isTokenRefreshInProgress) {
      return this.isTokenRefreshInProgress;
    }

    // Start token refresh process
    this.isTokenRefreshInProgress = this.refreshToken();
    try {
      const newToken = await this.isTokenRefreshInProgress;
      return newToken;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  /**
   * Refresh the authentication token
   * @returns New authentication token
   */
  private async refreshToken(): Promise<string> {
    try {
      // Get endpoint configuration from database
      const endpointConfig = await this.endpointConfigRepository.getOne({
        partnerCode: PARTNER_CODE_ENUM.SHIPYAARI,
        endpointId: "AUTH_TOKEN",
      });

      if (!endpointConfig) {
        throw new Error("Auth endpoint configuration not found for Shipyaari");
      }

      const email = this.configService.get<string>(SHIPYAARI_ENV_VARS.USERNAME);
      const password = this.configService.get<string>(
        SHIPYAARI_ENV_VARS.PASSWORD
      );

      if (!email || !password) {
        throw new Error("Shipyaari authentication credentials are missing");
      }

      const authDto = new ShipyaariAuthReqDto();
      authDto.email = email;
      authDto.password = password;

      // Use the URL from the endpoint configuration
      const url = endpointConfig.url;
      this.logger.debug(`Authenticating with Shipyaari at ${url}`);

      const response = await firstValueFrom(
        this.httpService
          .post<ShipyaariAuthResDto>(url, authDto, {
            headers: {
              "Content-Type": endpointConfig.contentType || "application/json",
            },
            timeout: endpointConfig.timeout || 30000,
          })
          .pipe(
            map((res) => res.data),
            catchError((error) => {
              this.logger.error(
                `Token refresh failed: ${error.message}`,
                error.stack
              );
              throw error;
            })
          )
      );

      if (!response.status || !response.token) {
        throw new Error(`Token refresh failed: ${response.message}`);
      }

      this.token = response.token;
      // Set token expiry to 23 hours from now (token typically valid for 24 hours)
      this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return this.token;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
