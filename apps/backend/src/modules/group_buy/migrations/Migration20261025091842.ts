import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025091842 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "group_buy_membership" drop constraint if exists "group_buy_membership_order_id_unique";`);
    this.addSql(`alter table if exists "group_buy_group" drop constraint if exists "group_buy_group_join_token_unique";`);
    this.addSql(`create table if not exists "group_buy_campaign" ("id" text not null, "name" text not null, "target_type" text check ("target_type" in ('orders', 'units', 'people')) not null, "target_value" integer not null, "max_total_orders" integer null, "max_units_per_person" integer null, "max_people_per_group" integer null, "group_mode" text check ("group_mode" in ('pool', 'team', 'both')) not null, "team_duration_hours" integer null, "pay_within_hours" integer not null default 24, "status" text check ("status" in ('draft', 'active', 'ended')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "group_buy_campaign_pkey" primary key ("id"), constraint group_buy_campaign_target_value_check check (target_value > 0), constraint group_buy_campaign_pay_within_hours_check check (pay_within_hours > 0), constraint group_buy_campaign_max_total_orders_check check (max_total_orders IS NULL OR max_total_orders > 0), constraint group_buy_campaign_max_units_per_person_check check (max_units_per_person IS NULL OR max_units_per_person > 0), constraint group_buy_campaign_max_people_per_group_check check (max_people_per_group IS NULL OR max_people_per_group > 0), constraint group_buy_campaign_team_duration_hours_check check (team_duration_hours IS NULL OR team_duration_hours > 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_campaign_deleted_at" ON "group_buy_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "group_buy_group" ("id" text not null, "campaign_id" text not null, "kind" text check ("kind" in ('pool', 'team')) not null, "created_by_customer_id" text null, "name" text null, "join_token" text not null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "status" text check ("status" in ('open', 'succeeded', 'failed')) not null default 'open', "succeeded_at" timestamptz null, "pay_deadline_at" timestamptz null, "progress_orders" integer not null default 0, "progress_units" integer not null default 0, "progress_people" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "group_buy_group_pkey" primary key ("id"), constraint group_buy_group_progress_check check (progress_orders >= 0 AND progress_units >= 0 AND progress_people >= 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_group_campaign_id" ON "group_buy_group" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_group_buy_group_join_token_unique" ON "group_buy_group" ("join_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_group_deleted_at" ON "group_buy_group" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_group_status_ends_at" ON "group_buy_group" ("status", "ends_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_group_status_pay_deadline_at" ON "group_buy_group" ("status", "pay_deadline_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "group_buy_membership" ("id" text not null, "campaign_id" text not null, "group_id" text not null, "customer_id" text not null, "order_id" text not null, "units" integer not null, "joined_at" timestamptz not null, "status" text check ("status" in ('joined', 'awaiting_payment', 'paid', 'cancelled')) not null default 'joined', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "group_buy_membership_pkey" primary key ("id"), constraint group_buy_membership_units_check check (units > 0));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_campaign_id" ON "group_buy_membership" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_group_id" ON "group_buy_membership" ("group_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_group_buy_membership_order_id_unique" ON "group_buy_membership" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_deleted_at" ON "group_buy_membership" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_campaign_id_customer_id" ON "group_buy_membership" ("campaign_id", "customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_group_buy_membership_group_id_status" ON "group_buy_membership" ("group_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "group_buy_group" add constraint "group_buy_group_campaign_id_foreign" foreign key ("campaign_id") references "group_buy_campaign" ("id") on update cascade;`);

    this.addSql(`alter table if exists "group_buy_membership" add constraint "group_buy_membership_campaign_id_foreign" foreign key ("campaign_id") references "group_buy_campaign" ("id") on update cascade;`);
    this.addSql(`alter table if exists "group_buy_membership" add constraint "group_buy_membership_group_id_foreign" foreign key ("group_id") references "group_buy_group" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "group_buy_group" drop constraint if exists "group_buy_group_campaign_id_foreign";`);

    this.addSql(`alter table if exists "group_buy_membership" drop constraint if exists "group_buy_membership_campaign_id_foreign";`);

    this.addSql(`alter table if exists "group_buy_membership" drop constraint if exists "group_buy_membership_group_id_foreign";`);

    this.addSql(`drop table if exists "group_buy_campaign" cascade;`);

    this.addSql(`drop table if exists "group_buy_group" cascade;`);

    this.addSql(`drop table if exists "group_buy_membership" cascade;`);
  }

}
