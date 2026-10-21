import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
import { RepositoryInterface } from './abstract-model-interface.js';

export abstract class AbstractModel<
  T extends ObjectLiteral,
> implements RepositoryInterface<T> {
  constructor(
    protected repository: Repository<T>,
    private entityClass: new () => T,
  ) {}

  protected getRepository(manager?: EntityManager): Repository<T> {
    return manager ? manager.getRepository(this.entityClass) : this.repository;
  }

  // create
  async create(data: DeepPartial<T>, manager?: EntityManager): Promise<T> {
    const repo = this.getRepository(manager);
    const entity = repo.create(data);
    return await repo.save(entity);
  }

  async createMany(
    data: DeepPartial<T>[],
    manager?: EntityManager,
  ): Promise<T[]> {
    const repo = this.getRepository(manager);
    const entities = repo.create(data);
    return await repo.save(entities);
  }

  // read
  async findById(id: string, manager?: EntityManager): Promise<T | null> {
    const repo = this.getRepository(manager);
    return await repo.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  // find one
  async findOne(
    options: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null> {
    const repo = this.getRepository(manager);
    return await repo.findOne(options);
  }

  async findAll(
    options?: FindManyOptions<T>,
    manager?: EntityManager,
  ): Promise<T[]> {
    const repo = this.getRepository(manager);
    return await repo.find(options);
  }

  async findWithPagination(
    page: number,
    limit: number,
    options?: FindManyOptions<T>,
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      ...options,
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  // update
  async update(
    id: string,
    data: Partial<T>,
    manager?: EntityManager,
  ): Promise<T | null> {
    const repo = this.getRepository(manager);
    await repo.update(id, data as QueryDeepPartialEntity<T>);
    return await this.findById(id, manager);
  }

  async updateMany(
    where: FindOptionsWhere<T>,
    data: Partial<T>,
  ): Promise<number> {
    const result = await this.repository.update(
      where,
      data as QueryDeepPartialEntity<T>,
    );
    return result.affected || 0;
  }

  // save
  async save(entity: Partial<T>, manager?: EntityManager): Promise<T> {
    const repo = this.getRepository(manager);
    return await repo.save(entity as DeepPartial<T>);
  }

  async saveMany(
    entities: Partial<T>[],
    manager?: EntityManager,
  ): Promise<T[]> {
    const repo = this.getRepository(manager);
    return await repo.save(entities as DeepPartial<T[]>);
  }

  // delete
  async delete(id: string, manager?: EntityManager): Promise<boolean> {
    const repo = this.getRepository(manager);
    const result = await repo.delete(id);
    return (result.affected || 0) > 0;
  }

  async deleteMany(where: FindOptionsWhere<T>): Promise<number> {
    const result = await this.repository.delete(where);
    return result.affected || 0;
  }
}
