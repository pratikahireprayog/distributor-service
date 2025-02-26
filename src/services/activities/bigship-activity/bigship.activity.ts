import { Logger, Injectable } from "@nestjs/common";
import { BigshipService } from "src/services/network-partners/bigship/bigship.service";

@Injectable()
export class BigshipActivity {
    constructor(
        private readonly bigshipService: BigshipService,
        private readonly logger: Logger
    ) { }

    async manifestOrder(manifestationDetails: BigshipOrderManifestationDetails): Promise<any> {
        this.logger.log('Bigship Order Manifestation Activity');
        try {
            this.logger.log('Manifesting order to Bigship');
            const response = await this.bigshipService.createManifestation(manifestationDetails);
            this.logger.log('Order manifested successfully');
            return response;
        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'An unknown error occurred';
            throw new Error(`Failed to send order to partner: ${errorMessage}`);
        }
    }
}