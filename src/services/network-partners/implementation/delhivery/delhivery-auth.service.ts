import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AuthProvider, TenantContext } from "src/common/interfaces/auth-provider.interface";
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
   * Uses tenant-specific credentials if available, otherwise falls back to default
   */
  async getAuthHeaders(tenantContext?: TenantContext): Promise<Record<string, string>> {
    const token = await this.getToken(tenantContext);
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
  }

  /**
   * Get authentication token (cached or generate new)
   * Uses tenant-specific credentials if available in tenantContext
   */
  async getToken(tenantContext?: TenantContext): Promise<string> {
    // Return cached token if valid (only for default credentials, not tenant-specific)
    if (!tenantContext?.partnerCredentials && this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      this.logger.debug("Using cached Delhivery token");
      return this.cachedToken;
    }

    // Generate new token (with tenant credentials if available)
    this.logger.debug(tenantContext?.partnerCredentials ? "Generating new Delhivery token with tenant credentials" : "Generating new Delhivery token");
    return await this.generateToken(tenantContext);
  }

  /**
   * Generate authentication token via Delhivery login API
   * Uses tenant-specific credentials if available in tenantContext
   */
  async generateToken(tenantContext?: TenantContext): Promise<string> {
    try {
      const loginUrl = this.configService.get<string>(
        "DELHIVERY_LOGIN_URL",
        "https://ltl-clients-api-dev.delhivery.com/ums/login"
      );
      
      // Use tenant-specific credentials if available, otherwise use default
      let username: string | undefined;
      let password: string | undefined;

      if (tenantContext?.partnerCredentials && tenantContext.partnerCredentials.length > 0) {
        // Extract credentials from tenant context
        const usernameCred = tenantContext.partnerCredentials.find(c => 
          c.key.toLowerCase() === 'username' || c.key.toLowerCase() === 'delhivery_username'
        );
        const passwordCred = tenantContext.partnerCredentials.find(c => 
          c.key.toLowerCase() === 'password' || c.key.toLowerCase() === 'delhivery_password'
        );
        
        username = usernameCred?.value;
        password = passwordCred?.value;
        
        if (username && password) {
          this.logger.debug(`Using tenant-specific credentials for tenant: ${tenantContext.tenantId}`);
        }
      }

      // Fallback to default credentials if tenant credentials not found
      if (!username || !password) {
        username = this.configService.get<string>("DELHIVERY_USERNAME");
        password = this.configService.get<string>("DELHIVERY_PASSWORD");
      }

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
            timeout: this.configService.get<number>("DELHIVERY_LOGIN_TIMEOUT_MS", 30000),
          }
        )
      );

      const responseData = response.data || {};

      // Extract token from response - check data.jwt first (as per API spec)
      const token = responseData.data?.jwt || responseData.jwt || responseData.token || responseData.data?.token;
      
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

