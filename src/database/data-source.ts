import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config({ path: join(import.meta.dirname, '../../.env') });

// Entities and migrations are loaded by glob. Under ts (dev/tests) the files
// end in .ts, in the compiled build they end in .js.
const fileExt = import.meta.filename.endsWith('.ts') ? 'ts' : 'js';

const entitiesPath = [
  join(import.meta.dirname, `../modules/**/models/*.${fileExt}`),
];
const migrationsPath = join(
  import.meta.dirname,
  `../database/migrations/*.${fileExt}`,
);

const dataSourceConfig: any = {
  type: process.env.DB_TYPE || 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB,
  entities: entitiesPath,
  migrations: [migrationsPath],
  synchronize: false, // schema changes go through migrations only
  logging: false,
};

export const dataSource = new DataSource(dataSourceConfig as DataSourceOptions);

/**
 * Initializes the data source (if TypeOrmModule hasn't already) and runs any
 * pending migrations. Called once from main.ts.
 */
export const initializeDataSource = async () => {
  const logger = new Logger('database');

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
    logger.log('Data source initialized');
  }

  const migrations = await dataSource.runMigrations();
  if (migrations.length > 0) {
    logger.log(`Ran ${migrations.length} migration(s)`);
  }
};
