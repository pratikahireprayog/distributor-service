import { Injectable, Logger } from "@nestjs/common";
import { NetworkPartnerFactoryService } from "src/services/network-partners/factory/network-partner-factory.service";
import {
  BaseCancelOrderDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseReqDto,
  BaseResDto,
} from "src/common/dtos/base.dto";

/**
 * Service for distributing operations to network partners
 */
@Injectable()
export class DistributorService {
  private readonly logger = new Logger(DistributorService.name);

  constructor(
    private readonly networkPartnerFactory: NetworkPartnerFactoryService
  ) {}

  async createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderData: T
  ): Promise<R> {
    this.logger.log(`Creating Order for ${orderData.awbNumber || "unknown"}`);

    // Determine which partner to use
    const partnerType = this.determinePartner(orderData);
    this.logger.debug(`Selected partner: ${partnerType}`);

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    // Execute the operation with the selected partner
    return partnerActivity.createOrder<T, R>(orderData);
  }

  async createManifest<
    T extends BaseReqDto = BaseReqDto,
    R extends BaseResDto = BaseResDto,
  >(data: T): Promise<R> {
    this.logger.log(
      `Creating Manifestation for ${data.awbNumber || "unknown"}`
    );

    // Determine which partner to use
    const partnerType = this.determinePartner(data);
    this.logger.debug(`Selected partner: ${partnerType}`);

    // Get the appropriate partner implementation
    const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    // Execute the operation with the selected partner
    return partnerActivity.createManifest<T, R>(data);
  }

  async getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R> {
    this.logger.debug(
      `Getting Order Details for ${params.awbNumber || "unknown"}`
    );

    // Get the appropriate partner implementation
    const partnerType = this.determinePartner(params);
    this.logger.debug(`Selected partner: ${partnerType}`);
    const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    // Execute the operation with the selected partner
    return partnerActivity.getOrderDetails<T, R>(params);
  }

  async cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R> {
    this.logger.debug(`Cancelling Order for ${data.awbNumber || "unknown"}`);

    // Get the appropriate partner implementation
    const partnerType = this.determinePartner(data);
    this.logger.debug(`Selected partner: ${partnerType}`);
    const partnerActivity = this.networkPartnerFactory.getPartner(partnerType);

    // Execute the operation with the selected partner
    return partnerActivity.cancelOrder<T, R>(data);
  }

  private determineOrderType(data: any): string {
    const orderType = data.type?.toUpperCase();

    if (!orderType) {
      this.logger.warn("Order type not specified in payload");
      throw new Error("Order type is required");
    }

    this.logger.debug(`Determined order type: ${orderType}`);
    return orderType;
  }

  private determinePartner(data: any): string | null {
    const partnerCode = data.partnerCode;

    if (!partnerCode) {
      this.logger.debug("Partner code not specified in payload");
      return null;
    }

    this.logger.debug(`Determined partner: ${partnerCode}`);
    return partnerCode;
  }

  private determineSubPartner(data: any): string | null {
    const subPartnerCode = data.subPartnerCode;

    if (!subPartnerCode) {
      this.logger.debug("Sub-partner code not specified in payload");
      return null;
    }

    this.logger.debug(`Determined sub-partner: ${subPartnerCode}`);
    return subPartnerCode;
  }
}
