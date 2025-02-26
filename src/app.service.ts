import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor() {
    this.logger.log('Distributor Temporal Worker Service initialized');
  }

  getWorkerStatus(): string {
    return 'Distributor Temporal Worker Service is running';
  }
}
