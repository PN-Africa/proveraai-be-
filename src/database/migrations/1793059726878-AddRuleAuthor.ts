import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRuleAuthor1793059726878 implements MigrationInterface {
    name = 'AddRuleAuthor1793059726878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detection_rules" ADD "createdById" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detection_rules" DROP COLUMN "createdById"`);
    }

}
