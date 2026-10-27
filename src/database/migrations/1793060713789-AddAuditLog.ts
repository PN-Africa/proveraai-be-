import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLog1793060713789 implements MigrationInterface {
    name = 'AddAuditLog1793060713789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" BIGSERIAL NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "actorId" uuid, "actorRole" character varying(20), "action" character varying(64) NOT NULL, "entityType" character varying(32), "entityId" character varying(100), "metadata" jsonb NOT NULL DEFAULT '{}', "ip" character varying(64), "prevHash" character(64) NOT NULL, "hash" character(64) NOT NULL, CONSTRAINT "UQ_67c4ff6334797c722a15eec21f1" UNIQUE ("hash"), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_48abb73a684410b7bf679c24c1" ON "audit_logs"  ("occurredAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_2dc33f7f3c22e2e7badafca1d1" ON "audit_logs"  ("actorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_f23279fad63453147a8efb46cf" ON "audit_logs"  ("entityId") `);
        // Append-only (AR-26): the database refuses any change or removal of an entry
        await queryRunner.query(`CREATE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$`);
        await queryRunner.query(`CREATE TRIGGER audit_logs_no_change BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()`);
        await queryRunner.query(`CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON "audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS audit_logs_no_change ON "audit_logs"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_append_only()`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f23279fad63453147a8efb46cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dc33f7f3c22e2e7badafca1d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48abb73a684410b7bf679c24c1"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
