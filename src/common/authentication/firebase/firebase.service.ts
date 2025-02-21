import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeliveryAgentRepository } from 'src/common/repositories/delivery-agent/delivery-agent.repository';

@Injectable()
export class FirebaseService {
  constructor(
    private readonly deliveryAgentRepository: DeliveryAgentRepository,
  ) {}

  async validateUser(payload: any) {
    // Perform database or external service lookup based on payload information
    // For example, find user by ID or username in your database
    if (!payload.mobile) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const deliveryAgent = await this.findDeliveryAgent(payload.mobile);
    const daUser: any = { ...deliveryAgent, authType: payload.authType };
    const user = daUser;
    return user; // Return the user if found, or null/undefined if not found
  }

  async findDeliveryAgent(mobile: string): Promise<any> {
    return await this.deliveryAgentRepository.getOne({
      mobile: mobile,
      isActive: true,
    });
  }
}
