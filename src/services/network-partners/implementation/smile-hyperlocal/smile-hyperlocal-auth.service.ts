import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import { lastValueFrom } from "rxjs";

interface TokenData {
  token: string;
  expiresAt: number;
}

@Injectable()
export class SmileHyperlocalAuthService implements AuthProvider {
  private readonly logger = new Logger(SmileHyperlocalAuthService.name);
  private tokenData: TokenData | null = null;
  private isTokenRefreshInProgress: Promise<TokenData> | null = null;
  private readonly TOKEN_VALIDITY_BUFFER = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    const tokenData = await this.getValidToken();
    return {
      Authorization: `Bearer ${tokenData.token}`,
      "Content-Type": "application/json",
    };
  }

  private async getValidToken(): Promise<TokenData> {
    if (this.isTokenValid()) {
      return this.tokenData!;
    }
    if (this.isTokenRefreshInProgress) {
      return this.isTokenRefreshInProgress;
    }
    this.isTokenRefreshInProgress = this.refreshToken();
    try {
      const newTokenData = await this.isTokenRefreshInProgress;
      this.tokenData = newTokenData;
      return newTokenData;
    } finally {
      this.isTokenRefreshInProgress = null;
    }
  }

  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    const currentTime = Date.now();
    return (
      this.tokenData.token &&
      this.tokenData.expiresAt > currentTime + this.TOKEN_VALIDITY_BUFFER
    );
  }

  private async refreshToken(): Promise<TokenData> {
    try {
      // Credentials should be stored in env or config
      const email = this.configService.get<string>("SMILE_HYPERLOCAL_EMAIL");
      const password = this.configService.get<string>("SMILE_HYPERLOCAL_PASSWORD");
      const vendorType = this.configService.get<string>("SMILE_HYPERLOCAL_VENDOR_TYPE");
      const url = this.configService.get<string>("SMILE_HYPERLOCAL_LOGIN_URL");

      if (!email || !password) {
        throw new Error("Smile Hyperlocal authentication credentials are missing");
      }

      const response = await lastValueFrom(
        this.httpService.post(url, {
          email,
          password,
          vendorType,
        }, {
          headers: { "Content-Type": "application/json" },
        })
      );

      const data = response.data;
      const token = data?.data?.token || data?.token;
      if (!token) {
        throw new Error("Token not found in Smile Hyperlocal login response");
      }
      // Assume token is valid for 23 hours
      const expiresAt = Date.now() + 23 * 60 * 60 * 1000;
      this.logger.debug("Successfully refreshed Smile Hyperlocal auth token");
      return { token, expiresAt };
    } catch (error) {
      this.logger.error(`Failed to refresh Smile Hyperlocal auth token: ${error.message}`);
      throw error;
    }
  }
} 