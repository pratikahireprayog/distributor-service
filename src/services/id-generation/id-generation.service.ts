import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  ID_GENERATION_ENV_CONST,
  ID_TYPE_CONST,
} from './id-generation.constant';
import { IDGenerationRQDto, IDGenerationResDto } from './id-generation.dto';
import { TokenService } from './token.service';

@Injectable()
export class IDGenerationService {
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: Logger,
    private readonly tokenService: TokenService,
  ) {
    this.apiUrl = `${process.env[ID_GENERATION_ENV_CONST.ID_GENERATION_BASE_URL]}/get-next-id`;
  }

  private async buildHeaders() {
    const token = await this.tokenService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private buildPayload(): IDGenerationRQDto {
    return {
      idType: ID_TYPE_CONST,
    };
  }

  async generateID(): Promise<string> {
    const headers = await this.buildHeaders();
    const payload: IDGenerationRQDto = this.buildPayload();

    try {
      const response: IDGenerationResDto = await firstValueFrom(
        this.httpService.post(this.apiUrl, payload, { headers }).pipe(
          map((response) => response.data),
          catchError((error: AxiosError) => {
            this.logError(error);
            throw new HttpException(
              'Failed to generate ID from external service',
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }),
        ),
      );

      this.logger.log(`Generated ID: ${response.id}`);
      return response.id;
    } catch (error) {
      this.logger.error('Error in generateID:', error);
      return this.generateLocalId();
    }
  }

  private generateLocalId(): string {
    const localId = uuidv4();
    this.logger.log(`Generated local ID: ${localId}`);
    return localId;
  }

  private logError(error: AxiosError): void {
    if (error.response) {
      this.logger.error(
        `Error response: ${JSON.stringify(error.response.data)}`,
      );
      this.logger.error(`Error status: ${error.response.status}`);
    } else if (error.request) {
      this.logger.error(`No response received: ${error.request}`);
    } else {
      this.logger.error(`Error setting up the request: ${error.message}`);
    }
  }
}
