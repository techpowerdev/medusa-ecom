import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025130418 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "evoucher_code" add column if not exists "void_reason" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "evoucher_code" drop column if exists "void_reason";`);
  }

}
