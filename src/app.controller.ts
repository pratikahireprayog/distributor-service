import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getStatus(): string {
    return this.appService.getStatus();
  }

  @Get('ping')
  async healthCheck(): Promise<any> {
    return { statusCode: 200, message: 'Distributor Service is running' };
  }
}
