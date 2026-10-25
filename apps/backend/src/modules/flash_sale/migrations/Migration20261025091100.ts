import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025091100 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_usage" drop constraint if exists "flash_sale_usage_campaign_id_customer_id_unique";`);
    this.addSql(`alter table if exists "flash_sale_config" drop constraint if exists "flash_sale_config_campaign_id_unique";`);
    this.addSql(`create table if not exists "flash_sale_config" ("id" text not null, "campaign_id" text not null, "per_customer_limit" integer null, "total_cap" integer null, "units_sold" integer not null default 0, "show_countdown" boolean not null default false, "show_remaining" boolean not null default false, "banner_text" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_sale_config_pkey" primary key ("id"), constraint flash_sale_config_units_sold_check check (units_sold >= 0), constraint flash_sale_config_per_customer_limit_check check (per_customer_limit IS NULL OR per_customer_limit > 0), constraint flash_sale_config_total_cap_check check (total_cap IS NULL OR total_cap > 0));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_sale_config_campaign_id_unique" ON "flash_sale_config" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_config_deleted_at" ON "flash_sale_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "flash_sale_usage" ("id" text not null, "campaign_id" text not null, "customer_id" text not null, "units" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_sale_usage_pkey" primary key ("id"), constraint flash_sale_usage_units_check check (units >= 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_usage_deleted_at" ON "flash_sale_usage" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_sale_usage_campaign_id_customer_id_unique" ON "flash_sale_usage" ("campaign_id", "customer_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "flash_sale_config" cascade;`);

    this.addSql(`drop table if exists "flash_sale_usage" cascade;`);
  }

}
