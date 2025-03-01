// import { Model, Document, UpdateQuery, FilterQuery } from 'mongoose';

// export abstract class BaseMongoRepository<T> {
//   protected readonly _model: Model<T>;

//   constructor(model: Model<T>) {
//     this._model = model;
//   }

//   private validateModelFields(item: any): any {
//     const allowedFields = Object.keys(this._model.schema.paths);
//     const invalidFields = Object.keys(item).filter(
//       (field) => !allowedFields.includes(field),
//     );

//     if (invalidFields.length > 0) {
//       throw new Error(
//         `Invalid fields: ${invalidFields.join(', ')}. These fields do not exist in the ${this._model.modelName}.`,
//       );
//     }

//     return item;
//   }

//   private validateFilterFields(filterObject: FilterQuery<T>) {
//     const allowedFields = Object.keys(this._model.schema.paths);
//     const invalidFields = Object.keys(filterObject).filter(
//       (field) => !allowedFields.includes(field),
//     );

//     if (invalidFields.length > 0) {
//       throw new Error(
//         `Invalid filter fields: ${invalidFields.join(', ')}. These fields do not exist in the ${this._model.modelName}.`,
//       );
//     }
//   }

//   async create(insert: any): Promise<T> {
//     const validItem = this.validateModelFields(insert);
//     return this._model.create(validItem);
//   }

//   async save(item: T & { _id: any }): Promise<T> {
//     const validItem = this.validateModelFields(item);
//     Object.assign(item, validItem);
//     return this._model
//       .findByIdAndUpdate(item._id, validItem, { new: true })
//       .lean();
//   }

//   async insertMany(insert: any[]): Promise<T[]> {
//     const validItems = insert.map((item: any) =>
//       this.validateModelFields(item),
//     );
//     return this._model.insertMany(validItems);
//   }

//   async update(id: string, item: Partial<T>): Promise<T | null> {
//     const validUpdate = this.validateModelFields(item);
//     return this._model.findByIdAndUpdate(id, validUpdate, { new: true }).lean();
//   }

//   async updateMany(
//     query: FilterQuery<T>,
//     update: UpdateQuery<T>,
//   ): Promise<any> {
//     return this._model.updateMany(query, update).lean();
//   }

//   async getAll(query: FilterQuery<T>, projection?: any): Promise<T[]> {
//     // this.validateFilterFields(query);
//     return this._model.find(query, projection).lean<T[]>().exec();
//   }

//   async getOne(query: FilterQuery<T>, projection?: any): Promise<T | null> {
//     this.validateFilterFields(query);
//     return this._model.findOne(query, projection).lean();
//   }

//   async delete(id: string): Promise<T | null> {
//     return this._model.findByIdAndDelete(id);
//   }

//   async aggregate(aggregation: any): Promise<any> {
//     return this._model.aggregate(aggregation).exec();
//   }

//   async count(query: FilterQuery<T>): Promise<number> {
//     this.validateFilterFields(query);
//     return this._model.countDocuments(query).exec();
//   }
// }

// export abstract class BaseMongoRepository<T extends Document> {
//   protected readonly _model: Model<T>;

//   constructor(model: Model<T>) {
//     this._model = model;
//   }

//   private validateModelFields(item: any): any {
//     const allowedFields = Object.keys(this._model.schema.paths);
//     const invalidFields = Object.keys(item).filter(
//       (field) => !allowedFields.includes(field),
//     );

//     if (invalidFields.length > 0) {
//       throw new Error(`Invalid fields found: ${invalidFields.join(', ')}`);
//     }

//     return item;
//   }

//   private validateFilterFields(filterObject: FilterQuery<T>) {
//     const allowedFields = Object.keys(this._model.schema.paths);
//     const invalidFields = Object.keys(filterObject).filter(
//       (field) => !allowedFields.includes(field),
//     );

//     if (invalidFields.length > 0) {
//       throw new Error(`Invalid filter fields: ${invalidFields.join(', ')}`);
//     }
//   }

//   /**
//    * Use this method to create a new document and save it to the database.
//    * This is a shortcut that combines instantiation and saving.
//    * @param insert - The document to be created.
//    * @returns The created document.
//    */
//   async create(insert: any): Promise<T> {
//     const validItem = this.validateModelFields(insert);
//     return this._model.create(validItem);
//   }

//   /**
//    * Use this method to save an already instantiated document.
//    * This can be used for both creating and updating documents.
//    * @param item - The document instance to be saved.
//    * @returns The saved document.
//    */
//   async save(item: T): Promise<T> {
//     const validItem = this.validateModelFields(item.toObject());
//     Object.assign(item, validItem);
//     return item.save();
//   }

//   /**
//    * Use this method to insert multiple documents into the database in one operation.
//    * This is more efficient for batch inserts compared to calling save() multiple times.
//    * @param insert - Array of documents to be inserted.
//    * @returns The inserted documents.
//    */
//   async insertMany(insert: any[]): Promise<T[]> {
//     const validItems = insert.map((item: any) =>
//       this.validateModelFields(item),
//     );
//     return this._model.insertMany(validItems);
//   }

//   async update(id: string, item: Partial<T>): Promise<T | null> {
//     const validUpdate = this.validateModelFields(item);
//     return this._model.findByIdAndUpdate(id, validUpdate, { new: true }).lean();
//   }

//   async updateMany(
//     query: FilterQuery<T>,
//     update: UpdateQuery<T>,
//   ): Promise<any> {
//     return this._model.updateMany(query, update).lean();
//   }

//   async getAll(query: FilterQuery<T>, projection?: any): Promise<T[]> {
//     this.validateFilterFields(query);
//     return this._model.find(query, projection).lean<T[]>().exec();
//   }

//   async getOne(query: FilterQuery<T>, projection?: any): Promise<T | null> {
//     this.validateFilterFields(query);
//     return this._model.findOne(query, projection).lean();
//   }

//   async delete(id: string): Promise<T | null> {
//     return this._model.findByIdAndDelete(id);
//   }

//   async aggregate(aggregation: any): Promise<any> {
//     return this._model.aggregate(aggregation).exec();
//   }

//   async count(query: FilterQuery<T>): Promise<number> {
//     this.validateFilterFields(query);
//     return this._model.countDocuments(query).exec();
//   }
// }
