import { Provider } from "@nestjs/common";
import { NetworkPartnerFactoryService } from "./factory/network-partner-factory.service";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { NETWORK_PARTNER_PROVIDER_CONST } from "./network-partners.constant";
import { BigshipService } from "./implementation/bigship/bigship.service";
import { TsawService } from "./implementation/tsaw/tsaw.service";
import { DefaultNetworkPartner } from "./implementation/default/default-network-partner.service";

export const networkPartnersProviders: Provider[] = [
  // Individual partner providers
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
    useClass: BigshipService,
  },
  // {
  //     provide: NETWORK_PARTNER_PROVIDER_CONST.TSAW,
  //     useClass: TsawService,
  // },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.DEFAULT,
    useClass: DefaultNetworkPartner,
  },
  // Factory initialization provider
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.FACTORY_INIT,
    useFactory: (
      factory: NetworkPartnerFactoryService,
      bigshipService: BigshipService,
      // tsawService: TsawService,
      defaultNetworkPartner: DefaultNetworkPartner
    ) => {
      // Register individual partners
      factory.registerPartner(PARTNER_CODE_ENUM.BIGSHIP, bigshipService);
      // factory.registerPartner(PARTNER_CODE_ENUM.TSAW, tsawService);

      // Register the default partner
      factory.registerDefaultPartner(defaultNetworkPartner);

      return factory;
    },
    inject: [
      NetworkPartnerFactoryService,
      NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
      // NETWORK_PARTNER_PROVIDER_CONST.TSAW,
      NETWORK_PARTNER_PROVIDER_CONST.DEFAULT,
    ],
  },
];
