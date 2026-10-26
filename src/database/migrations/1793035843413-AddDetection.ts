import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDetection1793035843413 implements MigrationInterface {
    name = 'AddDetection1793035843413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."detection_rules_type_enum" AS ENUM('HIGH_AMOUNT', 'AMOUNT_DEVIATION', 'VELOCITY', 'NEW_CONTEXT', 'NEAR_DUPLICATE', 'ODD_HOURS')`);
        await queryRunner.query(`CREATE TABLE "detection_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ruleKey" character varying(64) NOT NULL, "version" integer NOT NULL DEFAULT '1', "name" character varying(100) NOT NULL, "type" "public"."detection_rules_type_enum" NOT NULL, "params" jsonb NOT NULL DEFAULT '{}', "weight" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_e6860ae87f891db1ced9d6f0e1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2b9452356c38c5cb8f4c8696c8" ON "detection_rules"  ("ruleKey", "version") `);
        await queryRunner.query(`CREATE TABLE "risk_indicators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "transactionId" uuid NOT NULL, "ruleId" uuid NOT NULL, "ruleKey" character varying(64) NOT NULL, "ruleName" character varying(100) NOT NULL, "weight" integer NOT NULL, "reason" text NOT NULL, "details" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_30a521a8bb20c8e660e4c0c2f52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f3372488caea723f0717b532cf" ON "risk_indicators"  ("transactionId") `);
        await queryRunner.query(`ALTER TABLE "upload_batches" ADD "flaggedRows" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "riskScore" integer`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "riskLevel" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "flagged" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "scoredAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_45be94ac77412421c26a14d906" ON "transactions"  ("riskLevel") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d0e3866662ff539a080b9545d" ON "transactions"  ("flagged") `);
        await queryRunner.query(`ALTER TABLE "risk_indicators" ADD CONSTRAINT "FK_f3372488caea723f0717b532cf6" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "risk_indicators" DROP CONSTRAINT "FK_f3372488caea723f0717b532cf6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d0e3866662ff539a080b9545d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_45be94ac77412421c26a14d906"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "scoredAt"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "flagged"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "riskLevel"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "riskScore"`);
        await queryRunner.query(`ALTER TABLE "upload_batches" DROP COLUMN "flaggedRows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3372488caea723f0717b532cf"`);
        await queryRunner.query(`DROP TABLE "risk_indicators"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b9452356c38c5cb8f4c8696c8"`);
        await queryRunner.query(`DROP TABLE "detection_rules"`);
        await queryRunner.query(`DROP TYPE "public"."detection_rules_type_enum"`);
    }

}
