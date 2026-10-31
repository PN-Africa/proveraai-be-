import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountDeactivated1793463868441 implements MigrationInterface {
    name = 'AddAccountDeactivated1793463868441'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."accounts_status_enum" ADD VALUE 'DEACTIVATED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounts_status_enum_old" AS ENUM('PENDING', 'ACTIVE')`);
        await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "status" TYPE "public"."accounts_status_enum_old" USING "status"::"text"::"public"."accounts_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounts_status_enum_old" RENAME TO "accounts_status_enum"`);
    }

}
