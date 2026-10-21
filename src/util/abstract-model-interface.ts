import {
  DeepPartial,
  FindManyOptions,
  FindOptionsWhere,
  EntityManager,
  FindOneOptions,
} from 'typeorm';

export interface RepositoryInterface<T> {
  create(data: DeepPartial<T>, manager?: EntityManager): Promise<T>;
  createMany(data: DeepPartial<T>[], manager?: EntityManager): Promise<T[]>;
  findById(id: string, manager?: EntityManager): Promise<T | null>;
  findOne(
    option?: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null>;
  findAll(options?: FindManyOptions<T>, manager?: EntityManager): Promise<T[]>;
  findWithPagination(
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
  }>;
  update(
    id: string,
    data: Partial<T>,
    manager?: EntityManager,
  ): Promise<T | null>;
  updateMany(where: FindOptionsWhere<T>, data: Partial<T>): Promise<number>;
  save(entity: Partial<T>, manager?: EntityManager): Promise<T>;
  saveMany(entities: Partial<T>[], manager?: EntityManager): Promise<T[]>;
  delete(id: string, manager?: EntityManager): Promise<boolean>;
  deleteMany(where: FindOptionsWhere<T>): Promise<number>;
}
