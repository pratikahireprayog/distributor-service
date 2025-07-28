import { Injectable } from "@nestjs/common";
import { AuthProvider } from "../../interfaces/auth-provider.interface";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PorterAuthService implements AuthProvider {
  constructor(private readonly configService: ConfigService) {}

    async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      "x-api-key": this.configService.get<string>('PORTER_API_KEY') ,
      "Content-Type": "application/json"
    };
  }
}
