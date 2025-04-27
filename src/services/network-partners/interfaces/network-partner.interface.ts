import {
  BaseReqDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
} from "src/common/dtos/base.dto";
import { EligiblePartnersData } from "src/common/dtos/global.dto";
import { PushOrdersToPrsDto } from "src/services/distributor/distributor.service";

/**
 * Interface defining the operations that can be performed by a network partner
 */
export interface INetworkPartner {
  createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R>;

  createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R>;

  cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Create DRS payload for an order
   * @param orderData Order data for DRS payload creation
   * @returns DRS payload data
   */
  createDRS<T extends BaseOrderReqDto, R extends DRSPayloadDTO>(
    orderData: T
  ): Promise<R>;

  /**
   * Push orders to PRS
   * @param data Data containing order IDs to push to PRS
   * @returns Response from PRS API
   */
  pushOrdersToPrs<T extends PushOrdersToPrsDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  // cancelOrder(orderId: string): Promise<any>;
}
