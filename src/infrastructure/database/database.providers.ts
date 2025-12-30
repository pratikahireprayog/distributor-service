import * as mongoose from 'mongoose';
import { RepositoryConst } from 'src/common';

export const databaseProviders = [
  // {
  //   provide: RepositoryConst.DATABASE_NAME_CONST.FULFILLMENT_DB,
  //   useFactory: async (): Promise<mongoose.Connection> => {
  //     const connection = await mongoose.createConnection(process.env.FULFILLMENT_DB_URL);
  //     return connection;
  //   },
  // },
  {
    provide: RepositoryConst.DATABASE_NAME_CONST.DISTRIBUTOR_DB,
    useFactory: async (): Promise<mongoose.Connection> => {
      const connection = mongoose.createConnection(process.env.DISTRIBUTOR_DB_URL);
      await connection.asPromise(); // 🔴 THIS IS THE FIX
      return connection;
      
    },
  },
];
