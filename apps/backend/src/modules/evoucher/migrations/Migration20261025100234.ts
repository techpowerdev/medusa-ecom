import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025100234 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "evoucher_code_reveal" ("id" text not null, "code_id" text not null, "actor_type" text not null, "actor_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "evoucher_code_reveal_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_reveal_code_id" ON "evoucher_code_reveal" ("code_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_reveal_deleted_at" ON "evoucher_code_reveal" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "evoucher_code_reveal" cascade;`);
  }

}
