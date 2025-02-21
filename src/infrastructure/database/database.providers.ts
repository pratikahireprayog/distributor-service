import * as mongoose from 'mongoose';
import { RepositoryConst } from 'src/common';

export const databaseProviders = [
  {
    provide: RepositoryConst.DATABASE_NAME_CONST.FULFILLMENT,
    useFactory: (): Promise<typeof mongoose> =>
      mongoose.connect(process.env.FULFILLMENT_DB_URL),
  },
];
