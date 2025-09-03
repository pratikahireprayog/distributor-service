import {
  BaseReqDto,
  BaseOrderReqDto,
  BaseOrderResDto,
  BaseResDto,
  BaseCancelOrderDto,
  DRSPayloadDTO,
  ManifestReqDto,
} from "src/common/dtos/base.dto";
import { BaseOrderReqDtoV2, BaseCancelOrderDtoV2, BaseUpdateOrderDtoV2 } from "src/common/dtos/base2.dto";
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

  createOrderV2<T extends BaseOrderReqDtoV2, R extends BaseOrderResDto>(
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

  cancelOrderV2<T extends BaseCancelOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  updateOrderV2<T extends BaseUpdateOrderDtoV2, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
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
  pushOrdersToPRS<T extends StandardRequestDto, R extends BaseResDto>(
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
  updateEcomOrderWebhook<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Create pickup request V2
   * @param data Pickup request data
   * @param partnerCode Partner code for the network partner
   * @param eligiblePartners Optional eligible partners data
   * @returns Response from pickup creation API
   */
  createPickupV2<T extends BaseReqDto, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  /**
   * Cancel pickup request V2
   * @param data Pickup cancellation data
   * @param partnerCode Partner code for the network partner
   * @param eligiblePartners Optional eligible partners data
   * @returns Response from pickup cancellation API
   */
  cancelPickupV2<T extends BaseReqDto, R extends BaseResDto>(
    data: T,
    partnerCode: string,
    eligiblePartners?: EligiblePartnersData
  ): Promise<R>;

  /**
   * Push order to HubOps system
   * @param data Order data for HubOps
   * @returns Response from HubOps API
   */
  pushOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Update order in HubOps system
   * @param data Order data for HubOps update
   * @returns Response from HubOps API
   */
  updateOrderToHubOps<T extends StandardRequestDto, R extends BaseResDto>(
    data: T
  ): Promise<R>;

  /**
   * Update partner information to HubOps for multiple shipments
   * @param requestDto Request data containing shipmentDetails array
   * @returns Combined response for all shipment updates
   */
  updatePartnerToHubOps<T extends any, R extends BaseResDto>(
    requestDto: T
  ): Promise<R>;

  // cancelOrder(orderId: string): Promise<any>;
}
