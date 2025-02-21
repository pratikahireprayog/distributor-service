export class Filter<T> {
  private criteria: Partial<Record<keyof T, any>> = {};
  private sortCriteria: Partial<Record<keyof T, 1 | -1>> = {};
  private limitValue: number | undefined;
  private skipValue: number | undefined;

  private validateField<K extends keyof T>(field: K): void {
    if (!(field in this.criteria)) {
      throw new Error(
        `Field ${field as string} is not a valid field in the model`,
      );
    }
  }

  equals<K extends keyof T>(field: K, value: T[K]): this {
    console.log(this);
    this.validateField(field);
    this.criteria[field] = value;
    return this;
  }

  greaterThan<K extends keyof T>(field: K, value: T[K]): this {
    this.validateField(field);
    this.criteria[field] = { $gt: value };
    return this;
  }

  lessThan<K extends keyof T>(field: K, value: T[K]): this {
    this.validateField(field);
    this.criteria[field] = { $lt: value };
    return this;
  }

  greaterThanOrEqual<K extends keyof T>(field: K, value: T[K]): this {
    this.validateField(field);
    this.criteria[field] = { $gte: value };
    return this;
  }

  lessThanOrEqual<K extends keyof T>(field: K, value: T[K]): this {
    this.validateField(field);
    this.criteria[field] = { $lte: value };
    return this;
  }

  in<K extends keyof T>(field: K, values: T[K][]): this {
    this.validateField(field);
    this.criteria[field] = { $in: values };
    return this;
  }

  notEqual<K extends keyof T>(field: K, value: T[K]): this {
    this.validateField(field);
    this.criteria[field] = { $ne: value };
    return this;
  }

  sortBy<K extends keyof T>(field: K, order: 1 | -1): this {
    this.validateField(field);
    this.sortCriteria[field] = order;
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  skip(skip: number): this {
    this.skipValue = skip;
    return this;
  }

  build(): { filter: Partial<Record<keyof T, any>>; options: any } {
    return {
      filter: this.criteria,
      options: {
        ...(this.sortCriteria && { sort: this.sortCriteria }),
        ...(this.limitValue && { limit: this.limitValue }),
        ...(this.skipValue && { skip: this.skipValue }),
      },
    };
  }
}

export class Aggregation<T> {
  private pipeline: any[] = [];

  private validateField<K extends keyof T>(field: K): void {
    if (!(field in this.pipeline)) {
      throw new Error(
        `Field ${field as string} is not a valid field in the model`,
      );
    }
  }

  match(filter: Filter<T>): this {
    const { filter: filterObject } = filter.build();
    this.pipeline.push({ $match: filterObject });
    return this;
  }

  group<K extends keyof T>(groupBy: Partial<Record<K, any>>): this {
    this.pipeline.push({ $group: groupBy });
    return this;
  }

  sort<K extends keyof T>(sortCriteria: Partial<Record<K, 1 | -1>>): this {
    this.pipeline.push({ $sort: sortCriteria });
    return this;
  }

  limit(limit: number): this {
    this.pipeline.push({ $limit: limit });
    return this;
  }

  skip(skip: number): this {
    this.pipeline.push({ $skip: skip });
    return this;
  }

  addStage(stage: any): this {
    this.pipeline.push(stage);
    return this;
  }

  build(): any[] {
    return this.pipeline;
  }
}

// Usage Example
// try {
//   // Create a filter
// const filter = new Filter<UserDocument>()
//   .greaterThanOrEqual('age', 18)
//   .equals('isActive', true)
//   .sortBy('age', 1)
//   .limit(10)
//   .skip(0);

//   userRepository.getAll(filter).then(users => console.log(users));
// } catch (error) {
//   console.error(error.message);  // Handle the error appropriately
// }
