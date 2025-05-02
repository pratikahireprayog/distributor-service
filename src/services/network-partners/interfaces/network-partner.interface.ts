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
import {
  pushOrdersToPRSDto,
  StandardRequestDto,
} from "src/services/distributor/distributor.service";

/**
 * Interface defining the operations that can be performed by a network partner
 */
export interface INetworkPartner {
  createManifest<T extends ManifestReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R>;

  createOrder<T extends BaseOrderReqDto, R extends BaseOrderResDto>(
    orderDetails: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  getOrderDetails<T extends BaseReqDto, R extends BaseResDto>(
    params: T
  ): Promise<R>;

  cancelOrder<T extends BaseCancelOrderDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Push orders to DRS
   * @param orderData Order data for DRS payload creation
   * @returns DRS payload data
   */
  pushOrderToDRS<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Push orders to PRS
   * @param data Data containing order IDs to push to PRS
   * @returns Response from PRS API
   */
  pushOrdersToPRS<T extends pushOrdersToPRSDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Push order to tracking system
   * @param data Order data for tracking
   * @returns Response from tracking API
   */
  pushOrderToTracking<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Manifest order to tracking system
   * @param data Order data for manifesting to tracking
   * @returns Response from tracking API
   */
  manifestOrderToTracking<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Update E-commerce order details
   * @param data Order data with first mile hub details
   * @returns Response from ecom update API
   */
  updateEcomOrder<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  // cancelOrder(orderId: string): Promise<any>;
}
