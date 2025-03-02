import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DistributorService } from './services/distributor/distributor.service';
import { BaseManifestReqDto, BaseManifestResDto } from './common/dtos/base.dto';

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
  async createManifest(@Body() manifestData: BaseManifestReqDto): Promise<BaseManifestResDto> {
    return this.distributorService.createManifest(manifestData);
  }
}
