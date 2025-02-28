import { Provider } from '@nestjs/common';
import { NetworkPartnerFactoryService } from './network-partner-factory.service';
import { BigshipService } from './bigship/bigship.service';
import { PARTNER_CODE_ENUM } from 'src/common/enums/global.enum';
import { NETWORK_PARTNER_PROVIDER_CONST } from './network-partners.constant';

export const networkPartnersProviders: Provider[] = [
    // Individual partner providers
    {
        provide: NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
        useClass: BigshipService,
    },
    // Factory initialization provider
    {
        provide: NETWORK_PARTNER_PROVIDER_CONST.FACTORY_INIT,
        useFactory: (
            factory: NetworkPartnerFactoryService,
            bigshipService: BigshipService,
        ) => {
            factory.registerPartner(PARTNER_CODE_ENUM.BIGSHIP, bigshipService);
            return factory;
        },
        inject: [
            NetworkPartnerFactoryService,
            NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
        ],
    },
]; 