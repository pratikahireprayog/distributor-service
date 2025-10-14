import { Controller, Get, Query } from "@nestjs/common";
import { NetworkPartnerFactoryService } from "../services/network-partners/factory/network-partner-factory.service";
import { IndiaPostDomesticService } from "../services/network-partners/implementation/india-post-domestic/india-post-domestic.service";

@Controller("test-india-post")
export class TestIndiaPostController {
  private readonly indiaPostService: IndiaPostDomesticService;

  constructor(
    private readonly networkPartnerFactory: NetworkPartnerFactoryService
  ) {
    this.indiaPostService = this.networkPartnerFactory.getPartner(
      "INDIA_POST_DOMESTIC"
    ) as IndiaPostDomesticService;
  }

  @Get("all")
  async testAllAPIs() {
    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    try {
      // Test 1: Pincode Search
      console.log("🔍 Testing Pincode Search API...");
      results.tests["pincode"] = {
        status: "running",
        startTime: Date.now(),
      };

      const pincodeResult =
        await this.indiaPostService.testPincodeSearchAPI("570024");
      results.tests["pincode"] = {
        status: "success",
        responseTime: Date.now() - results.tests["pincode"].startTime,
        data: pincodeResult,
      };
      console.log("✅ Pincode API: SUCCESS");
    } catch (error) {
      results.tests["pincode"] = {
        status: "failed",
        error: error.message,
        details: error,
      };
      console.log("❌ Pincode API: FAILED -", error.message);
    }

    try {
      // Test 2: Tariff API
      console.log("💰 Testing Tariff API...");
      results.tests["tariff"] = {
        status: "running",
        startTime: Date.now(),
      };

      const tariffResult = await this.indiaPostService.testTariffAPI();
      results.tests["tariff"] = {
        status: "success",
        responseTime: Date.now() - results.tests["tariff"].startTime,
        data: tariffResult,
      };
      console.log("✅ Tariff API: SUCCESS");
    } catch (error) {
      results.tests["tariff"] = {
        status: "failed",
        error: error.message,
        details: error,
      };
      console.log("❌ Tariff API: FAILED -", error.message);
    }

    try {
      // Test 3: Outbound Events API
      console.log("📦 Testing Outbound Events API...");
      results.tests["outbound"] = {
        status: "running",
        startTime: Date.now(),
      };

      const outboundResult =
        await this.indiaPostService.testOutboundEventsAPI();
      results.tests["outbound"] = {
        status: "success",
        responseTime: Date.now() - results.tests["outbound"].startTime,
        data: outboundResult,
      };
      console.log("✅ Outbound Events API: SUCCESS");
    } catch (error) {
      results.tests["outbound"] = {
        status: "failed",
        error: error.message,
        details: error,
      };
      console.log("❌ Outbound Events API: FAILED -", error.message);
    }

    return results;
  }

  @Get("pincode")
  async testPincode(@Query("pincode") pincode: string = "570024") {
    try {
      const result = await this.indiaPostService.testPincodeSearchAPI(pincode);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message, details: error };
    }
  }

  @Get("tariff")
  async testTariff() {
    try {
      const result = await this.indiaPostService.testTariffAPI();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message, details: error };
    }
  }

  @Get("outbound")
  async testOutbound() {
    try {
      const result = await this.indiaPostService.testOutboundEventsAPI();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message, details: error };
    }
  }

  @Get("create-order-v1")
  async testCreateOrderV1() {
    try {
      // This should fail for India Post since V1 is not supported
      const mockOrder = {
        awbNumber: "TEST123456789",
        customerName: "Test Customer",
        customerPhone: "9876543210",
        packageDetails: { weight: 500 },
      };

      const result = await this.indiaPostService.createOrder(
        mockOrder as any,
        "INDIA_POST_DOMESTIC"
      );
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        note: "This is expected - India Post only supports V2",
        details: error,
      };
    }
  }

  @Get("create-order-v2")
  async testCreateOrderV2() {
    try {
      // Test V2 order creation (main implementation)
      const mockOrderV2 = {
        awbNumber: "TEST123456789V2",
        addresses: [
          {
            type: "pickup",
            contactName: "Sender Name",
            addressLine1: "123 Pickup Street",
            city: "Bangalore",
            state: "Karnataka",
            pincode: "560001",
            phone: "9876543210",
          },
          {
            type: "delivery",
            contactName: "Receiver Name",
            addressLine1: "456 Delivery Avenue",
            city: "Mysore",
            state: "Karnataka",
            pincode: "570024",
            phone: "9876543211",
          },
        ],
        packages: [
          {
            weight: 500,
            length: 10,
            breadth: 10,
            height: 10,
          },
        ],
      };

      const result = await this.indiaPostService.createOrderV2(
        mockOrderV2 as any,
        "INDIA_POST_DOMESTIC"
      );
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message, details: error };
    }
  }
}
