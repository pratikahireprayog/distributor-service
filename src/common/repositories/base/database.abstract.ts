import { Model, UpdateQuery, FilterQuery, Document } from 'mongoose';

export abstract class BaseMongoRepository<T extends Document> {
  protected readonly _model: Model<T>;

  constructor(model: Model<T>) {
    this._model = model;
  }

  async create(item: Partial<T>): Promise<any> {
    const doc = await this._model.create(item);
    return doc.toJSON();
  }

  async save(item: T & { _id: any }): Promise<any> {
    const doc = await this._model.findByIdAndUpdate(item._id, item as any, { new: true });
    return doc?.toJSON() || null;
  }

  async insertMany(items: Partial<T>[]): Promise<any[]> {
    const docs = await this._model.insertMany(items);
    return docs.map(doc => doc.toJSON());
  }

  async update(id: string, item: Partial<T>): Promise<any> {
    const doc = await this._model.findByIdAndUpdate(id, item as any, { new: true });
    return doc?.toJSON() || null;
  }

  async updateOne(
    query: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: { upsert?: boolean; new?: boolean }
  ): Promise<any> {
    const doc = await this._model.findOneAndUpdate(query, update, options);
    return doc?.toJSON() || null;
  }

  async updateMany(
    query: FilterQuery<T>,
    update: UpdateQuery<T>,
  ): Promise<any> {
    return this._model.updateMany(query, update);
  }

  async getAll(query: FilterQuery<T>, projection?: any): Promise<any[]> {
    const docs = await this._model.find(query, projection);
    return docs.map(doc => doc.toJSON());
  }

  async getOne(query: FilterQuery<T>, projection?: any): Promise<any> {
    const doc = await this._model.findOne(query, projection);
    return doc?.toJSON() || null;
  }

  async delete(id: string): Promise<any> {
    const doc = await this._model.findByIdAndDelete(id);
    return doc?.toJSON() || null;
  }

  async aggregate(aggregation: any[]): Promise<any> {
    return this._model.aggregate(aggregation);
  }

  async count(query: FilterQuery<T>): Promise<number> {
    return this._model.countDocuments(query);
  }
}
