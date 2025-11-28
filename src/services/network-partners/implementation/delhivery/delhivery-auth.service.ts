import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AuthProvider } from "src/common/interfaces/auth-provider.interface";
import { CustomHttpException } from "src/infrastructure/exception-handlers";

/**
 * Delhivery authentication service
 * Handles token generation and caching
 */
@Injectable()
export class DelhiveryAuthService implements AuthProvider {
  private readonly logger = new Logger(DelhiveryAuthService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Get authentication headers with Bearer token
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
  }

  /**
   * Get authentication token (cached or generate new)
   */
  async getToken(): Promise<string> {
    // Return cached token if valid
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      this.logger.debug("Using cached Delhivery token");
      return this.cachedToken;
    }

    // Generate new token
    this.logger.debug("Generating new Delhivery token");
    return await this.generateToken();
  }

  /**
   * Generate authentication token via Delhivery login API
   */
  async generateToken(): Promise<string> {
    try {
      const loginUrl = this.configService.get<string>(
        "DELHIVERY_LOGIN_URL",
        "https://ltl-clients-api-dev.delhivery.com/ums/login"
      );
      
      const username = this.configService.get<string>("DELHIVERY_USERNAME");
      const password = this.configService.get<string>("DELHIVERY_PASSWORD");

      if (!username || !password) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          "DELHIVERY_USERNAME or DELHIVERY_PASSWORD not configured"
        );
      }

      this.logger.debug(`Calling Delhivery login API: ${loginUrl}`);

      const response = await firstValueFrom(
        this.httpService.post(
          loginUrl,
          {
            username,
            password,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        )
      );

      const responseData = response.data || {};

      // Extract token from response
      const token = responseData.token || responseData.data?.token;
      
      if (!token) {
        throw new CustomHttpException(
          HttpStatus.UNAUTHORIZED,
          `Delhivery login failed: ${responseData.message || "No token received"}`
        );
      }

      // Cache token (set expiry to 23 hours to be safe)
      this.cachedToken = token;
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      this.logger.log("Successfully generated Delhivery authentication token");
      return token;
    } catch (error) {
      this.logger.error(`Delhivery token generation failed: ${error.message}`);
      if (error instanceof CustomHttpException) {
        throw error;
      }
      throw new CustomHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Delhivery token generation failed: ${error.message}`
      );
    }
  }
}

