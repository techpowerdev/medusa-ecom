import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261108223817 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_entry_order_id" ON "affiliate_commission_entry" ("order_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_affiliate_commission_entry_order_id";`);
  }

}
