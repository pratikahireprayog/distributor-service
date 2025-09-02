import { Injectable } from "@nestjs/common";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PorterAuthService implements AuthProvider {
  constructor(private readonly configService: ConfigService) {}

    async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      "x-api-key": "659d4aaf-3797-4186-b7c3-2c231f5d0e22",
      "Content-Type": "application/json"
    };
  }
}
