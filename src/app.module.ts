import {
  Logger,
  Module,
} from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { TemporalModule } from './infrastructure/temporal/temporal.module';
import { DistributorModule } from './services/distributor/distributor.module';
import { NetworkPartnersModule } from './services/network-partners/network-partners.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    TemporalModule,
    DistributorModule,
    NetworkPartnersModule,
  ],
  providers: [AppService, Logger],
})
export class AppModule { }
