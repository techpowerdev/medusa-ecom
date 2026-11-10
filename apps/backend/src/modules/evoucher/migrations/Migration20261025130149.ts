import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025130149 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_order_id" ON "evoucher_code" ("order_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_evoucher_code_order_id";`);
  }

}
