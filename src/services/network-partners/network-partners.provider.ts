import { Provider } from '@nestjs/common';
import { NetworkPartnerFactoryService } from './factory/network-partner-factory.service';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { NETWORK_PARTNER_PROVIDER_CONST } from './network-partners.constant';
import { BigshipService } from './implementation/bigship/bigship.service';
import { TsawService } from './implementation/tsaw/tsaw.service';

export const networkPartnersProviders: Provider[] = [
    // Individual partner providers
    {
        provide: NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
        useClass: BigshipService,
    },
    {
        provide: NETWORK_PARTNER_PROVIDER_CONST.TSAW,
        useClass: TsawService,
    },
    // Factory initialization provider
    {
        provide: NETWORK_PARTNER_PROVIDER_CONST.FACTORY_INIT,
        useFactory: (
            factory: NetworkPartnerFactoryService,
            bigshipService: BigshipService,
            tsawService: TsawService,
        ) => {
            factory.registerPartner(PARTNER_CODE_ENUM.BIGSHIP, bigshipService);
            factory.registerPartner(PARTNER_CODE_ENUM.TSAW, tsawService);
            return factory;
        },
        inject: [
            NetworkPartnerFactoryService,
            NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
            NETWORK_PARTNER_PROVIDER_CONST.TSAW,
        ],
    },
]; 