import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUploadFileHash1792790669375 implements MigrationInterface {
    name = 'AddUploadFileHash1792790669375'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "upload_batches" ADD "fileHash" character(64)`);
        await queryRunner.query(`CREATE INDEX "IDX_fd7673f4b89fe08714baf563ba" ON "upload_batches"  ("fileHash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fd7673f4b89fe08714baf563ba"`);
        await queryRunner.query(`ALTER TABLE "upload_batches" DROP COLUMN "fileHash"`);
    }

}
