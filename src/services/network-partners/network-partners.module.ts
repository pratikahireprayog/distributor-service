import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetworkPartnerFactoryService } from './factory/network-partner-factory.service';
import { BigshipService } from './bigship/bigship.service';
import { PartnerType } from '../../common/enums/partner-type.enum';

/**
 * Module for network partners
 */
@Module({
    imports: [
        HttpModule,
        ConfigModule,
    ],
    providers: [
        NetworkPartnerFactoryService,
        BigshipService,
        {
            provide: 'NETWORK_PARTNERS_INIT',
            useFactory: (
                factory: NetworkPartnerFactoryService,
                bigshipService: BigshipService,
            ) => {
                // Register all network partners with the factory
                factory.registerPartner(PartnerType.BIGSHIP, bigshipService);

                return factory;
            },
            inject: [NetworkPartnerFactoryService, BigshipService],
        },
    ],
    exports: [NetworkPartnerFactoryService],
})
export class NetworkPartnersModule { } 