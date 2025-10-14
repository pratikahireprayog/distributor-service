import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

import { IndiaPostDomesticService } from "./india-post-domestic.service";
import { IndiaPostDomesticAuthService } from "./india-post-domestic-auth.service";
import { EndpointConfigModule } from "src/common/repositories/endpoint-configs/endpoint-configs.module";
import { SchemaMapperModule } from "src/infrastructure/schema-mapper/schema-mapper.module";
import { INDIA_POST_DOMESTIC_CONFIG } from "./india-post-domestic.enum";

/**
 * India Post Domestic Module
 * Provides all services and dependencies for India Post Domestic integration
 *
 * Features:
 * - HTTP client with timeout configuration
 * - Configuration management for environment variables
 * - Schema mapping for request/response transformation
 * - Endpoint configuration management
 */
@Module({
  imports: [
    // HTTP client configuration
    HttpModule.register({
      timeout: INDIA_POST_DOMESTIC_CONFIG.HTTP_TIMEOUT_MS,
      maxRedirects: 5,
      // Additional HTTP configuration can be added here
      headers: {
        "User-Agent": "India-Post-Domestic-Client/1.0",
      },
    }),

    // Configuration module for environment variables
    ConfigModule,

    // Endpoint configuration for dynamic API management
    EndpointConfigModule,

    // Schema mapping for request/response transformation
    SchemaMapperModule,
  ],

  providers: [
    // Main service
    IndiaPostDomesticService,

    // Authentication service
    IndiaPostDomesticAuthService,
  ],

  exports: [
    // Export services for use in other modules
    IndiaPostDomesticService,
    IndiaPostDomesticAuthService,
  ],
})
export class IndiaPostDomesticModule {}
