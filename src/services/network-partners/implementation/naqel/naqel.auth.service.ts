import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../../interfaces/auth-provider.interface';
import { CustomHttpException } from 'src/infrastructure/exception-handlers';

@Injectable()
export class NAQELAuthService implements AuthProvider {
  private readonly logger = new Logger(NAQELAuthService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private isTokenRefreshInProgress: Promise<void> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) { }

  async getAuthHeaders(): Promise<Record<string, string>> {
    // const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer `, // token
    };
  }

  // private async getToken(): Promise<string> {
  //   try {
     
     
  //   } catch (error) {
    
  //   }
  // }

  private async authenticate(): Promise<void> {
    try {
     
     
    } catch (error) {
    
    }
  }

}


