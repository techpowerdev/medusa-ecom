import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261027125915 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_customer_id_status" ON "evoucher_code" ("customer_id", "status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_evoucher_code_customer_id_status";`);
  }

}
