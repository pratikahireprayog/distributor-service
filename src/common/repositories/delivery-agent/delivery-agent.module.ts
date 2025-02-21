import { Module } from '@nestjs/common';
import { DeliveryAgentRepository } from './delivery-agent.repository';
import { deliveryAgentProvider } from './delivery-agent.provider';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [DeliveryAgentRepository, ...deliveryAgentProvider],
  exports: [DeliveryAgentRepository],
})
export class DeliveryAgentRepositoryModule {}
