import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviews1793057893490 implements MigrationInterface {
    name = 'AddReviews1793057893490'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reviews_status_enum" AS ENUM('OPEN', 'IN_REVIEW', 'CLOSED')`);
        await queryRunner.query(`CREATE TYPE "public"."reviews_decision_enum" AS ENUM('CLEARED', 'ESCALATED')`);
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "transactionId" uuid NOT NULL, "reviewerId" uuid NOT NULL, "status" "public"."reviews_status_enum" NOT NULL DEFAULT 'IN_REVIEW', "decision" "public"."reviews_decision_enum", "notes" text, "claimedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "decidedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "REL_6f8c2191fd56f6342f22579b90" UNIQUE ("transactionId"), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f9238c3e3739dc40322f577fc4" ON "reviews"  ("reviewerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b06c23cf52ca8aea0dcaf0ee2" ON "reviews"  ("status") `);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_6f8c2191fd56f6342f22579b90b" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_f9238c3e3739dc40322f577fc46" FOREIGN KEY ("reviewerId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_f9238c3e3739dc40322f577fc46"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_6f8c2191fd56f6342f22579b90b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b06c23cf52ca8aea0dcaf0ee2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9238c3e3739dc40322f577fc4"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP TYPE "public"."reviews_decision_enum"`);
        await queryRunner.query(`DROP TYPE "public"."reviews_status_enum"`);
    }

}
