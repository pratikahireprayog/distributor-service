import { Module } from '@nestjs/common';
import { MPUserRepository } from './mp-user.repository';
import { mpUserProvider } from './mp-user.provider';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [MPUserRepository, ...mpUserProvider],
  exports: [MPUserRepository],
})
export class MPUserRepositoryModule {}
