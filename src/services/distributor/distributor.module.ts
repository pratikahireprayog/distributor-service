import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetworkPartnersModule } from '../network-partners/network-partners.module';
import { DistributorService } from './distributor.service';

/**
 * Module for distributor service
 */
@Module({
    imports: [
        ConfigModule,
        NetworkPartnersModule,
    ],
    providers: [DistributorService],
    exports: [DistributorService],
})
export class DistributorModule { } 