import { Provider } from "@nestjs/common";
import { NetworkPartnerFactoryService } from "./factory/network-partner-factory.service";
import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { NETWORK_PARTNER_PROVIDER_CONST } from "./network-partners.constant";
import { BigshipService } from "./implementation/bigship/bigship.service";
import { TsawService } from "./implementation/tsaw/tsaw.service";
import { DefaultNetworkPartner } from "./implementation/default/default-network-partner.service";
import { ShipyaariService } from "./implementation/shipyaari/shipyaari.service";
import { DHLService } from "./implementation/dhl/dhl.service";
import { SmileHyperlocalService } from "./implementation/smile-hyperlocal/smile-hyperlocal.service";
import { PorterService } from "./implementation/porter/porter.service";
import { SmileHubopsService } from "./implementation/smile-hubops/smile-hubops.service";
import { UniuniService } from "./implementation/uniuni/uniuni.service";
import { BaralService } from "./implementation/baral/baral.service";

export const networkPartnersProviders: Provider[] = [
  // Individual partner providers
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.BARAL,
    useClass: BaralService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
    useClass: BigshipService,
  },
  {
      provide: NETWORK_PARTNER_PROVIDER_CONST.TSAW,
      useClass: TsawService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.SHIPYAARI,
    useClass: ShipyaariService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.DHL,
    useClass: DHLService, 
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.SMILE_HYPERLOCAL,
    useClass: SmileHyperlocalService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.PORTER,
    useClass: PorterService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.SMILE_HUBOPS,
    useClass: SmileHubopsService,
  },
  {
    provide: NETWORK_PARTNER_PROVIDER_CONST.UNIUNI,
    useClass: UniuniService,
  },
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
      tsawService: TsawService,
      shipyaariService: ShipyaariService,
      dhlService: DHLService,
      smileHyperlocalService: SmileHyperlocalService,
      porterService: PorterService,
      smileHubopsService: SmileHubopsService,
      uniuniService: UniuniService,
      defaultNetworkPartner: DefaultNetworkPartner,
      baralService: BaralService
    ) => {
      // Register individual partners
      factory.registerPartner(PARTNER_CODE_ENUM.BIGSHIP, bigshipService);
      factory.registerPartner(PARTNER_CODE_ENUM.TSAW, tsawService);
      factory.registerPartner(PARTNER_CODE_ENUM.SHIPYAARI, shipyaariService);
      factory.registerPartner(PARTNER_CODE_ENUM.DHL, dhlService);
      factory.registerPartner(PARTNER_CODE_ENUM.SMILE_HYPERLOCAL, smileHyperlocalService);
      factory.registerPartner(PARTNER_CODE_ENUM.PORTER, porterService);
      factory.registerPartner(
        PARTNER_CODE_ENUM.SMILE_HUBOPS,
        smileHubopsService
      );
      factory.registerPartner(PARTNER_CODE_ENUM.UNIUNI, uniuniService);
      factory.registerPartner(PARTNER_CODE_ENUM.BARAL, baralService);

      // Register the default partner
      factory.registerDefaultPartner(defaultNetworkPartner);

      return factory;
    },
    inject: [
      NetworkPartnerFactoryService,
      NETWORK_PARTNER_PROVIDER_CONST.BIGSHIP,
      NETWORK_PARTNER_PROVIDER_CONST.TSAW,
      NETWORK_PARTNER_PROVIDER_CONST.SHIPYAARI,
      NETWORK_PARTNER_PROVIDER_CONST.DHL,
      NETWORK_PARTNER_PROVIDER_CONST.SMILE_HYPERLOCAL,
      NETWORK_PARTNER_PROVIDER_CONST.PORTER,
      NETWORK_PARTNER_PROVIDER_CONST.SMILE_HUBOPS,
      NETWORK_PARTNER_PROVIDER_CONST.UNIUNI,
      NETWORK_PARTNER_PROVIDER_CONST.DEFAULT,
      NETWORK_PARTNER_PROVIDER_CONST.BARAL,
    ],
  },
];
