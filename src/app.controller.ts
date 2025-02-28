import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DistributorService } from './services/distributor/distributor.service';
import { CreateManifestDto } from './common/dtos/global.dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly distributorService: DistributorService,
  ) { }

  @Get()
  getStatus(): string {
    return this.appService.getStatus();
  }

  @Get('ping')
  async healthCheck(): Promise<any> {
    return { statusCode: 200, message: 'Distributor Service is running' };
  }

  @Post('create-manifest')
  async createManifest(@Body() manifestData: CreateManifestDto): Promise<any> {
    return this.distributorService.createManifest(manifestData);
  }
}
