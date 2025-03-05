# Partner DTO Guide

This guide explains how to use the generic DTO approach for handling different partner payloads in the Distributor Service.

## Overview

The Distributor Service uses a generic approach with TypeScript generics to handle different partner-specific DTOs while maintaining type safety. This approach allows:

- Type checking during development
- Flexibility to add new partners without modifying core components
- Clear separation of concerns
- Minimal code changes when adding new partners

## Architecture

The architecture consists of:

1. **Base DTOs**: Common interfaces that all partner DTOs extend
2. **Partner-specific DTOs**: Interfaces that extend the base DTOs with partner-specific fields
3. **Generic interfaces**: Service interfaces that use generics to handle any partner DTO

## How It Works

1. The client sends a request to the `createManifest` endpoint
2. The controller accepts the request and passes it to the distributor service
3. The distributor service determines the partner type from the request
4. The appropriate partner implementation is selected from the factory
5. The partner implementation processes the request with its specific logic
6. The response is returned to the client

## Adding a New Partner

To add a new partner, follow these steps:

### 1. Define Partner-specific DTOs

Create interfaces for the partner's request and response DTOs in `src/common/dtos/base.dto.ts`:

```typescript
// Request DTO
export interface NewPartnerManifestDto extends BaseReqDto {
  // Partner-specific fields
  specialField1: string;
  specialField2: number;
}

// Response DTO
export interface NewPartnerManifestResponse extends BaseResDto {
  // Partner-specific response fields
  statusCode: number;
  partnerData: any;
}
```

### 2. Implement the Partner Service

Create a new service that extends `BaseNetworkPartner`:

```typescript
@Injectable()
export class NewPartnerService extends BaseNetworkPartner {
  constructor() {
    // Inject dependencies
    super(
      PARTNER_CODE_ENUM.NEW_PARTNER,
      authProvider,
      httpService,
      endpointConfigRepository,
      schemaMapper
    );
  }

  async createManifest<T extends BaseReqDto, R extends BaseResDto>(
    manifestationDetails: T
  ): Promise<R> {
    // Call the base implementation
    const response = await super.createManifest<T, R>(manifestationDetails);

    // Add partner-specific post-processing
    // ...

    return response;
  }

  // Implement required abstract methods
  protected getTrackOrderEndpoint(trackingId: string): PartnerEndpoint {
    // ...
  }

  protected getCancelOrderEndpoint(orderId: string): PartnerEndpoint {
    // ...
  }
}
```

### 3. Register the Partner with the Factory

In your module's `providers` array, add a provider to register the partner:

```typescript
{
  provide: 'REGISTER_PARTNER',
  useFactory: (
    partnerService: NewPartnerService,
    factoryService: NetworkPartnerFactoryService,
  ) => {
    factoryService.registerPartner('NEW_PARTNER', partnerService);
    return true;
  },
  inject: [NewPartnerService, NetworkPartnerFactoryService],
},
```

### 4. Update Partner Code Enum (if needed)

Add the new partner code to the `PARTNER_CODE_ENUM` in `src/common/enums/global.enum.ts`:

```typescript
export enum PARTNER_CODE_ENUM {
  BIGSHIP = "BIGSHIP",
  NEW_PARTNER = "NEW_PARTNER",
  // ...
}
```

## Usage Example

```typescript
// Client code
const newPartnerData: NewPartnerManifestDto = {
  awbNumber: "12345",
  systemOrderId: 1002651866,
  partnerCode: "NEW_PARTNER",
  specialField1: "value1",
  specialField2: 42,
};

// The type inference works automatically
const response = await distributorService.createManifest(newPartnerData);
```

## Benefits

- **Type Safety**: Compile-time type checking reduces runtime errors
- **Flexibility**: Easy to add new partners without modifying core components
- **Maintainability**: Clear separation of concerns
- **Developer Experience**: Better IDE support with type hints

## Best Practices

1. Always extend the base DTOs for consistency
2. Keep partner-specific logic in the partner service
3. Use meaningful field names in DTOs
4. Document partner-specific requirements
5. Add validation for partner-specific fields
