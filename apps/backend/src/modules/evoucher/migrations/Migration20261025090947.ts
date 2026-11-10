import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025090947 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "evoucher_code" drop constraint if exists "evoucher_code_pool_id_code_unique";`);
    this.addSql(`alter table if exists "evoucher_pool" drop constraint if exists "evoucher_pool_variant_id_unique";`);
    this.addSql(`create table if not exists "evoucher_partner" ("id" text not null, "name" text not null, "logo_url" text null, "terms_url" text null, "support_contact" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "evoucher_partner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_partner_deleted_at" ON "evoucher_partner" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "evoucher_pool" ("id" text not null, "partner_id" text not null, "variant_id" text not null, "name" text not null, "face_value" numeric null, "validity_note" text null, "how_to_use" text not null, "low_stock_threshold" integer not null default 20, "raw_face_value" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "evoucher_pool_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_pool_partner_id" ON "evoucher_pool" ("partner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_evoucher_pool_variant_id_unique" ON "evoucher_pool" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_pool_deleted_at" ON "evoucher_pool" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "evoucher_code" ("id" text not null, "pool_id" text not null, "code" text not null, "pin" text null, "expires_at" timestamptz null, "batch_ref" text not null, "status" text check ("status" in ('available', 'allocated', 'delivered', 'void')) not null default 'available', "order_id" text null, "order_line_item_id" text null, "customer_id" text null, "allocated_at" timestamptz null, "delivered_at" timestamptz null, "delivered_to_email" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "evoucher_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_pool_id" ON "evoucher_code" ("pool_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_deleted_at" ON "evoucher_code" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_evoucher_code_pool_id_code_unique" ON "evoucher_code" ("pool_id", "code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_evoucher_code_pool_id_status" ON "evoucher_code" ("pool_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "evoucher_pool" add constraint "evoucher_pool_partner_id_foreign" foreign key ("partner_id") references "evoucher_partner" ("id") on update cascade;`);

    this.addSql(`alter table if exists "evoucher_code" add constraint "evoucher_code_pool_id_foreign" foreign key ("pool_id") references "evoucher_pool" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "evoucher_pool" drop constraint if exists "evoucher_pool_partner_id_foreign";`);

    this.addSql(`alter table if exists "evoucher_code" drop constraint if exists "evoucher_code_pool_id_foreign";`);

    this.addSql(`drop table if exists "evoucher_partner" cascade;`);

    this.addSql(`drop table if exists "evoucher_pool" cascade;`);

    this.addSql(`drop table if exists "evoucher_code" cascade;`);
  }

}
