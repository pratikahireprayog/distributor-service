import { Model } from 'mongoose';
import { Inject } from '@nestjs/common';
import { MPUserDocument } from './mp-user.schema';
import { REPOSITORY_MODEL_PROVIDER_CONST } from 'src/common/constants';
import { BaseMongoRepository } from 'src/common/abstracts/database.abstract';

export class MPUserRepository extends BaseMongoRepository<MPUserDocument> {
  constructor(
    @Inject(REPOSITORY_MODEL_PROVIDER_CONST.MP_USER_MODEL)
    private readonly mpUserModel: Model<MPUserDocument>,
  ) {
    super(mpUserModel);
  }
}
