import { MigrationInterface, QueryRunner } from 'typeorm';

// Every account is an analyst that works on its own data:
// - accounts: no ADMIN role, no PENDING (approval) status
// - transactions: owned by the uploader; transactionId unique per owner
// - detection_rules: owned per account (defaults are copied on first use);
//   the shared rules are removed and createdById is dropped
// - reviews: a review is the decision only; status and claimedAt are dropped
export class PerUserData1793896000000 implements MigrationInterface {
  name = 'PerUserData1793896000000';

  // Written to run on a database whose schema drifted from the earlier
  // migrations (e.g. an enum already without ADMIN): enum values are compared
  // as text, and every add or drop is guarded.
  public async up(queryRunner: QueryRunner): Promise<void> {
    // accounts
    await queryRunner.query(`UPDATE "accounts" SET "role" = 'ANALYST' WHERE "role"::text <> 'ANALYST'`);
    await queryRunner.query(`UPDATE "accounts" SET "status" = 'ACTIVE' WHERE "status"::text NOT IN ('ACTIVE', 'DEACTIVATED')`);
    await queryRunner.query(`ALTER TYPE "public"."accounts_role_enum" RENAME TO "accounts_role_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."accounts_role_enum" AS ENUM('ANALYST')`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" TYPE "public"."accounts_role_enum" USING "role"::"text"::"public"."accounts_role_enum"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" SET DEFAULT 'ANALYST'`);
    await queryRunner.query(`DROP TYPE "public"."accounts_role_enum_old"`);
    await queryRunner.query(`ALTER TYPE "public"."accounts_status_enum" RENAME TO "accounts_status_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."accounts_status_enum" AS ENUM('ACTIVE', 'DEACTIVATED')`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" TYPE "public"."accounts_status_enum" USING "status"::"text"::"public"."accounts_status_enum"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`);
    await queryRunner.query(`DROP TYPE "public"."accounts_status_enum_old"`);

    // transactions: existing rows belong to whoever uploaded them
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "ownerId" uuid`);
    await queryRunner.query(`UPDATE "transactions" t SET "ownerId" = u."uploadedById" FROM "upload_batches" u WHERE u."id" = t."uploadId" AND t."ownerId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "ownerId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "UQ_1eb69759461752029252274c105"`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_431c7f64542dae04698928c5c8" ON "transactions" ("ownerId") `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_3fefda5422d479b59dd32221ea" ON "transactions" ("ownerId", "transactionId") `);

    // detection_rules: the shared rules go; each account gets its own default
    // copy the first time it needs rules. Indicators keep their own rule
    // name, weight and reason, so past explanations are unaffected.
    await queryRunner.query(`DELETE FROM "detection_rules"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_2b9452356c38c5cb8f4c8696c8"`);
    await queryRunner.query(`ALTER TABLE "detection_rules" DROP COLUMN IF EXISTS "createdById"`);
    await queryRunner.query(`ALTER TABLE "detection_rules" ADD COLUMN IF NOT EXISTS "ownerId" uuid NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_630252261aeb689de87f674749" ON "detection_rules" ("ownerId") `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cd2c7b453e858ab7471295e2c6" ON "detection_rules" ("ownerId", "ruleKey", "version") `);

    // reviews: claims without a decision are dropped (those transactions are
    // OPEN again); decided reviews always have their decision, notes and time
    await queryRunner.query(`DELETE FROM "reviews" WHERE "decision" IS NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_7b06c23cf52ca8aea0dcaf0ee2"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."reviews_status_enum"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "claimedAt"`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "decision" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "notes" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "decidedAt" SET NOT NULL`);
  }

  // Restores the old schema. Data that only exists per account cannot go back:
  // rules are emptied (the old code seeds them again on startup), and the old
  // global unique transactionId fails if two accounts stored the same one.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "decidedAt" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "notes" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "decision" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD "claimedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`UPDATE "reviews" SET "claimedAt" = "decidedAt"`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "claimedAt" SET NOT NULL`);
    await queryRunner.query(`CREATE TYPE "public"."reviews_status_enum" AS ENUM('OPEN', 'IN_REVIEW', 'CLOSED')`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD "status" "public"."reviews_status_enum" NOT NULL DEFAULT 'IN_REVIEW'`);
    await queryRunner.query(`UPDATE "reviews" SET "status" = 'CLOSED'`);
    await queryRunner.query(`CREATE INDEX "IDX_7b06c23cf52ca8aea0dcaf0ee2" ON "reviews" ("status") `);

    await queryRunner.query(`DELETE FROM "detection_rules"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cd2c7b453e858ab7471295e2c6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_630252261aeb689de87f674749"`);
    await queryRunner.query(`ALTER TABLE "detection_rules" DROP COLUMN "ownerId"`);
    await queryRunner.query(`ALTER TABLE "detection_rules" ADD "createdById" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2b9452356c38c5cb8f4c8696c8" ON "detection_rules" ("ruleKey", "version") `);

    await queryRunner.query(`DROP INDEX "public"."IDX_3fefda5422d479b59dd32221ea"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_431c7f64542dae04698928c5c8"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "ownerId"`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "UQ_1eb69759461752029252274c105" UNIQUE ("transactionId")`);

    await queryRunner.query(`ALTER TYPE "public"."accounts_status_enum" RENAME TO "accounts_status_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."accounts_status_enum" AS ENUM('PENDING', 'ACTIVE', 'DEACTIVATED')`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" TYPE "public"."accounts_status_enum" USING "status"::"text"::"public"."accounts_status_enum"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    await queryRunner.query(`DROP TYPE "public"."accounts_status_enum_old"`);
    await queryRunner.query(`ALTER TYPE "public"."accounts_role_enum" RENAME TO "accounts_role_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."accounts_role_enum" AS ENUM('ADMIN', 'ANALYST')`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" TYPE "public"."accounts_role_enum" USING "role"::"text"::"public"."accounts_role_enum"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "role" SET DEFAULT 'ANALYST'`);
    await queryRunner.query(`DROP TYPE "public"."accounts_role_enum_old"`);
  }
}
