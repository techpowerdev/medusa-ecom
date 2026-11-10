import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025085824 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "affiliate_commission_entry" drop constraint if exists "affiliate_commission_entry_order_id_line_item_id_unique";`);
    this.addSql(`alter table if exists "affiliate_attribution" drop constraint if exists "affiliate_attribution_order_id_unique";`);
    this.addSql(`alter table if exists "affiliate" drop constraint if exists "affiliate_code_unique";`);
    this.addSql(`alter table if exists "affiliate" drop constraint if exists "affiliate_email_unique";`);
    this.addSql(`create table if not exists "affiliate" ("id" text not null, "email" text not null, "name" text not null, "code" text not null, "status" text check ("status" in ('pending', 'active', 'suspended')) not null default 'pending', "payout_info" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_email_unique" ON "affiliate" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_code_unique" ON "affiliate" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_deleted_at" ON "affiliate" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "affiliate_attribution" ("id" text not null, "order_id" text not null, "affiliate_id" text not null, "program_id" text null, "attributed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_attribution_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_attribution_order_id_unique" ON "affiliate_attribution" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_attribution_affiliate_id" ON "affiliate_attribution" ("affiliate_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_attribution_deleted_at" ON "affiliate_attribution" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "affiliate_commission_entry" ("id" text not null, "affiliate_id" text not null, "program_id" text not null, "order_id" text not null, "line_item_id" text null, "amount" numeric not null, "currency" text not null, "status" text check ("status" in ('pending', 'approved', 'reversed', 'paid')) not null default 'pending', "reason" text null, "matures_at" timestamptz null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_commission_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_entry_deleted_at" ON "affiliate_commission_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_entry_affiliate_id_status_created_at" ON "affiliate_commission_entry" ("affiliate_id", "status", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_commission_entry_order_id_line_item_id_unique" ON "affiliate_commission_entry" ("order_id", "line_item_id") WHERE status = 'pending' AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "affiliate_payout" ("id" text not null, "affiliate_id" text not null, "amount" numeric not null, "currency" text not null, "period_from" timestamptz not null, "period_to" timestamptz not null, "status" text check ("status" in ('draft', 'paid')) not null default 'draft', "paid_at" timestamptz null, "reference" text null, "entry_ids" text[] not null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_payout_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_payout_affiliate_id" ON "affiliate_payout" ("affiliate_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_payout_deleted_at" ON "affiliate_payout" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "affiliate_program" ("id" text not null, "name" text not null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "status" text check ("status" in ('draft', 'published', 'ended')) not null default 'draft', "announce_text" text null, "commission_type" text check ("commission_type" in ('percentage')) not null default 'percentage', "commission_value" numeric not null, "scope" jsonb not null, "attribution_window_days" integer not null default 7, "cap_per_order" numeric null, "hold_days" integer not null default 14, "raw_commission_value" jsonb not null, "raw_cap_per_order" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_program_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_program_deleted_at" ON "affiliate_program" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "affiliate" cascade;`);

    this.addSql(`drop table if exists "affiliate_attribution" cascade;`);

    this.addSql(`drop table if exists "affiliate_commission_entry" cascade;`);

    this.addSql(`drop table if exists "affiliate_payout" cascade;`);

    this.addSql(`drop table if exists "affiliate_program" cascade;`);
  }

}
