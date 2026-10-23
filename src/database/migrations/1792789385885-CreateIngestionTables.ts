import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIngestionTables1792789385885 implements MigrationInterface {
    name = 'CreateIngestionTables1792789385885'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."upload_batches_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "upload_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "fileName" character varying(255) NOT NULL, "uploadedById" uuid NOT NULL, "status" "public"."upload_batches_status_enum" NOT NULL DEFAULT 'PENDING', "totalRows" integer NOT NULL DEFAULT '0', "acceptedRows" integer NOT NULL DEFAULT '0', "rejectedRows" integer NOT NULL DEFAULT '0', "error" text, "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ba93a3c8b208932f309cc1ad674" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_28f991f307363b0aeab4f07f33" ON "upload_batches"  ("uploadedById") `);
        await queryRunner.query(`CREATE TABLE "rejected_rows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "uploadId" uuid NOT NULL, "rowNumber" integer NOT NULL, "transactionId" character varying(100), "reasons" jsonb NOT NULL, CONSTRAINT "PK_6df5243a702041a2b32d6ba92c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0cf5bf08b831713a8f8bc96558" ON "rejected_rows"  ("uploadId") `);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "uploadId" uuid NOT NULL, "transactionId" character varying(100) NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character varying(10) NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "type" character varying(50) NOT NULL, "customerId" character varying(100), "paymentMethod" character varying(50), "location" character varying(100), "attributes" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_1eb69759461752029252274c105" UNIQUE ("transactionId"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18aac314e4a13b135ac53671c7" ON "transactions"  ("uploadId") `);
        await queryRunner.query(`CREATE INDEX "IDX_94237f916ec4821df58c06c413" ON "transactions"  ("occurredAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_52a272e6c6a006922bc80d7e19" ON "transactions"  ("customerId") `);
        await queryRunner.query(`ALTER TABLE "rejected_rows" ADD CONSTRAINT "FK_0cf5bf08b831713a8f8bc965581" FOREIGN KEY ("uploadId") REFERENCES "upload_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_18aac314e4a13b135ac53671c7c" FOREIGN KEY ("uploadId") REFERENCES "upload_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_18aac314e4a13b135ac53671c7c"`);
        await queryRunner.query(`ALTER TABLE "rejected_rows" DROP CONSTRAINT "FK_0cf5bf08b831713a8f8bc965581"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52a272e6c6a006922bc80d7e19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94237f916ec4821df58c06c413"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18aac314e4a13b135ac53671c7"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0cf5bf08b831713a8f8bc96558"`);
        await queryRunner.query(`DROP TABLE "rejected_rows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28f991f307363b0aeab4f07f33"`);
        await queryRunner.query(`DROP TABLE "upload_batches"`);
        await queryRunner.query(`DROP TYPE "public"."upload_batches_status_enum"`);
    }

}
