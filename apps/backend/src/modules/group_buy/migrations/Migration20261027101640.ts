import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261027101640 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_customer_id_joined_at" ON "group_buy_membership" ("customer_id", "joined_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_group_buy_membership_customer_id_joined_at";`);
  }

}
