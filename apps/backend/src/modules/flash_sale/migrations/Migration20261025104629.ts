import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025104629 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_reservation" drop constraint if exists "flash_sale_reservation_cart_id_campaign_id_unique";`);
    this.addSql(`create table if not exists "flash_sale_reservation" ("id" text not null, "cart_id" text not null, "campaign_id" text not null, "customer_id" text not null, "units" integer not null, "released_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_sale_reservation_pkey" primary key ("id"), constraint flash_sale_reservation_units_check check (units > 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_reservation_deleted_at" ON "flash_sale_reservation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_sale_reservation_cart_id_campaign_id_unique" ON "flash_sale_reservation" ("cart_id", "campaign_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "flash_sale_reservation" cascade;`);
  }

}
