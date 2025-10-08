import { Injectable, Logger } from "@nestjs/common";
import { AlertNotificationService } from "@innofulfill/core-node-library";

export interface DistributorAlertPayload {
  traceId?: string;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  errorStatus: number;
  errorStatusText: string;
  errorMessage: string;
  endpoint: string;
  method: string;
  requestId?: string;
  awbNumber?: string;
  partnerCode?: string;
  errorStack?: string;
  additionalInfo?: Record<string, any>;
}

@Injectable()
export class DiscordAlertService {
  private readonly logger = new Logger(DiscordAlertService.name);

  async sendErrorAlert(payload: DistributorAlertPayload): Promise<void> {
    this.logger.log(
      `🚨 Attempting to send Discord alert for ${payload.serviceName} error...`
    );
    this.logger.log(`Environment: ${payload.environment}`);
    this.logger.log(`Error Status: ${payload.errorStatus}`);
    this.logger.log(`Error Message: ${payload.errorMessage}`);

    try {
      const alertService = new AlertNotificationService();
      this.logger.log(`📱 AlertNotificationService initialized successfully`);

      const discordPayload = {
        channel: { discord: {} },
        traceId: payload.traceId || "trace-" + Date.now(),
        metaData: {
          service: payload.serviceName,
          version: payload.serviceVersion,
          environment: payload.environment,
        },
        error: {
          status: payload.errorStatus,
          statusText: payload.errorStatusText,
          message: payload.errorMessage,
          endpoint: payload.endpoint,
          method: payload.method,
          timestamp: new Date().toISOString(),
          stack: payload.errorStack,
          requestId: payload.awbNumber || payload.requestId,
          additionalInfo: {
            ...payload.additionalInfo,
            awbNumber: payload.awbNumber,
            partnerCode: payload.partnerCode,
          },
        },
      };

      this.logger.log(
        `📤 Sending Discord alert with payload: ${JSON.stringify(discordPayload, null, 2)}`
      );

      const result = await alertService.sendToDiscord(discordPayload);
      this.logger.log(`🔄 Discord API response: ${JSON.stringify(result)}`);

      this.logger.log(
        `✅ Discord alert sent successfully for ${payload.serviceName}`
      );
    } catch (alertError) {
      this.logger.error(
        `❌ Failed to send Discord alert for ${payload.serviceName}: ${alertError.message}`
      );
      this.logger.error(`Alert error stack: ${alertError.stack}`);
      this.logger.error(`Alert error details: ${JSON.stringify(alertError)}`);
    }
  }

  async sendOrderCreationErrorAlert(
    error: any,
    awbNumber?: string,
    partnerCode?: string,
    requestId?: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.sendErrorAlert({
      serviceName: "Distributor-Service",
      serviceVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      errorStatus: error.status || 500,
      errorStatusText: error.statusText || "Internal Server Error",
      errorMessage: error.message,
      endpoint: "/distributor/create-order",
      method: "POST",
      requestId,
      awbNumber,
      partnerCode,
      errorStack: error.stack,
      additionalInfo: {
        ...additionalInfo,
        operationType: "OrderCreation",
      },
    });
  }

  async sendManifestCreationErrorAlert(
    error: any,
    awbNumbers?: string[],
    partnerCode?: string,
    requestId?: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.sendErrorAlert({
      serviceName: "Distributor-Service",
      serviceVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      errorStatus: error.status || 500,
      errorStatusText: error.statusText || "Internal Server Error",
      errorMessage: error.message,
      endpoint: "/distributor/create-manifest",
      method: "POST",
      requestId,
      awbNumber: awbNumbers?.join(","),
      partnerCode,
      errorStack: error.stack,
      additionalInfo: {
        ...additionalInfo,
        operationType: "ManifestCreation",
        awbCount: awbNumbers?.length,
      },
    });
  }

  async sendOrderDetailsErrorAlert(
    error: any,
    awbNumber?: string,
    partnerCode?: string,
    requestId?: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.sendErrorAlert({
      serviceName: "Distributor-Service",
      serviceVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      errorStatus: error.status || 500,
      errorStatusText: error.statusText || "Internal Server Error",
      errorMessage: error.message,
      endpoint: "/distributor/get-order-details",
      method: "GET",
      requestId,
      awbNumber,
      partnerCode,
      errorStack: error.stack,
      additionalInfo: {
        ...additionalInfo,
        operationType: "GetOrderDetails",
      },
    });
  }

  async sendOrderCancellationErrorAlert(
    error: any,
    awbNumbers?: string[],
    partnerCode?: string,
    requestId?: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.sendErrorAlert({
      serviceName: "Distributor-Service",
      serviceVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      errorStatus: error.status || 500,
      errorStatusText: error.statusText || "Internal Server Error",
      errorMessage: error.message,
      endpoint: "/distributor/cancel-order",
      method: "POST",
      requestId,
      awbNumber: awbNumbers?.join(","),
      partnerCode,
      errorStack: error.stack,
      additionalInfo: {
        ...additionalInfo,
        operationType: "OrderCancellation",
        awbCount: awbNumbers?.length,
      },
    });
  }

  async sendPushOrderErrorAlert(
    error: any,
    operation: string,
    awbNumber?: string,
    partnerCode?: string,
    requestId?: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.sendErrorAlert({
      serviceName: "Distributor-Service",
      serviceVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      errorStatus: error.status || 500,
      errorStatusText: error.statusText || "Internal Server Error",
      errorMessage: error.message,
      endpoint: `/distributor/${operation.toLowerCase()}`,
      method: "POST",
      requestId,
      awbNumber,
      partnerCode,
      errorStack: error.stack,
      additionalInfo: {
        ...additionalInfo,
        operationType: operation,
      },
    });
  }

  async sendAwbSeriesAlert(payload: {
    partnerCode: string;
    orderId: string;
    alertType: string;
    threshold?: number;
    consumptionPercentage?: number;
    currentCounter?: number;
    seriesStart?: number;
    seriesEnd?: number;
    remaining?: number;
    message: string;
    severity: "info" | "warning" | "error" | "critical";
  }): Promise<void> {
    this.logger.log(
      `🚨 Sending AWB Series Alert for ${payload.partnerCode} - ${payload.alertType}`
    );

    try {
      const alertService = new AlertNotificationService();

      // Determine status code based on severity
      const statusMap = {
        info: 200,
        warning: 400,
        error: 500,
        critical: 503,
      };

      const discordPayload = {
        channel: { discord: {} },
        traceId: `awb-series-${Date.now()}`,
        metaData: {
          service: "Distributor-Service",
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
        },
        error: {
          status: statusMap[payload.severity],
          statusText: `AWB Series Alert - ${payload.alertType}`,
          message: payload.message,
          endpoint: "/awb-series/assignment",
          method: "POST",
          timestamp: new Date().toISOString(),
          requestId: payload.orderId,
          additionalInfo: {
            partnerCode: payload.partnerCode,
            orderId: payload.orderId,
            alertType: payload.alertType,
            threshold: payload.threshold,
            consumptionPercentage: payload.consumptionPercentage,
            currentCounter: payload.currentCounter,
            seriesStart: payload.seriesStart,
            seriesEnd: payload.seriesEnd,
            remaining: payload.remaining,
            severity: payload.severity,
          },
        },
      };

      this.logger.log(
        `📤 Sending AWB Series Discord alert: ${JSON.stringify(discordPayload, null, 2)}`
      );

      const result = await alertService.sendToDiscord(discordPayload);
      this.logger.log(`🔄 Discord API response: ${JSON.stringify(result)}`);

      this.logger.log(
        `✅ AWB Series alert sent successfully for ${payload.partnerCode}`
      );
    } catch (alertError) {
      this.logger.error(
        `❌ Failed to send AWB Series alert for ${payload.partnerCode}: ${alertError.message}`
      );
      this.logger.error(`Alert error stack: ${alertError.stack}`);
    }
  }
}
