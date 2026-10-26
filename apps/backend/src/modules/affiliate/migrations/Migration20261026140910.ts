import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261026140910 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_entry_status_matures_at" ON "affiliate_commission_entry" ("status", "matures_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_affiliate_commission_entry_status_matures_at";`);
  }

}
