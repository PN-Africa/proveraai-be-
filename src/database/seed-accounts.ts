import { Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AccountStatus } from '../modules/auth/enums/account-status.enum.js';
import { Role } from '../modules/auth/enums/role.enum.js';
import { AccountModel } from '../modules/auth/models/auth.model.js';
import { dataSource } from './data-source.js';

export const seedAccounts = async () => {
  const logger = new Logger('SeedAccounts');
  const accountRepo = dataSource.getRepository(AccountModel);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.warn('Skipping account seeding: missing env variables');
    return;
  }

  // Seed Admin
  const adminExists = await accountRepo.exists({ where: { email: adminEmail } });
  if (!adminExists) {
    const admin = accountRepo.create({
      fullName: process.env.ADMIN_FULL_NAME?.trim() || 'Administrator',
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    });
    await accountRepo.save(admin);
    logger.log(`Seeded Admin account: ${adminEmail}`);
  }
};
