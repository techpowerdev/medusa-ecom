# Database ของ production: index, migration และ backup/restore (OPS-5)

อ้างอิง: `docs/spec/07-scaling-ops.md` Deliverables ข้อ 4 (index), ข้อ 7 (backup) และ AC-4 — ไม่มี infra ใหม่:
ใช้ `pg_dump`/`pg_restore` ที่มากับ image `postgres:16` ของ `docker-compose.prod.yml` (prod จริงใช้ snapshot ของ managed Postgres)

## Index และ migration ของ custom module
ตรวจ 2026-11-09 บน `develop` (`apps/backend/src/modules/{affiliate,evoucher,flash_sale,group_buy}`; `digital_fulfillment`/`resend` เป็น provider ไม่มีตาราง)
- **migration ตรงกับ model**: `npx medusa db:generate <module>` ทั้งสี่ module ได้ `Skipped. No changes detected in your models.`
  และ index ใน DB หลัง `db:migrate` ตรงกับ `.snapshot-*.json` ทุกตัว (ผลอยู่ใน `docs/evidence/ops/OPS-5-tests.txt`)
- **query ที่ใช้บ่อยมี index** — `EXPLAIN ANALYZE` บนข้อมูลสังเคราะห์ขนาดประมาณร้านหลังเปิด 1 ปี (membership/code/ledger ตารางละ 200k แถว)
  ผลเต็มใน `docs/evidence/ops/OPS-5-explain.txt`:

| query (ที่มา) | index ที่ใช้ |
|---|---|
| `GET /store/group-buy/groups/:token` | `group_buy_group (join_token)` unique |
| `GET /store/group-buy/campaigns/active` (pool ที่ open) | `group_buy_group (status, ends_at)` |
| `GET /store/customers/me/group-buy/memberships` | `group_buy_membership (customer_id, joined_at)` |
| `GET /store/customers/me/evouchers` | `evoucher_code (customer_id, status)` |
| checkout flash (usage, reservation ต่อ cart, config ต่อ campaign) | `flash_sale_usage (campaign_id, customer_id)`, `flash_sale_reservation (cart_id, campaign_id)`, `flash_sale_config (campaign_id)` |
| claim e-voucher ตอน order placed | `evoucher_code (pool_id, status)` |
| attribution ต่อ order | `affiliate_attribution (order_id)` unique |
| job `group-buy-deadline` (ทุกนาที) กลุ่มที่หมดเวลา | `group_buy_group (status, ends_at)` |
| reversal / maturity / payout ค้น ledger ด้วย `order_id` | `affiliate_commission_entry (order_id)` — **เพิ่มใน OPS-5** (เดิม Parallel Seq Scan ~22ms → Index Scan ~0.2ms) |

- ช่องว่างที่ยังเหลือ (ไม่แก้ใน OPS-5 เพราะต้องแก้ query ของ job ไม่ใช่ index): job `group-buy-deadline` ส่วน membership `awaiting_payment`
  กรอง `group.pay_deadline_at` โดยไม่กรองสถานะกลุ่ม จึงใช้ index `(status, pay_deadline_at)` ไม่ได้ (Seq Scan ตาราง group ~50–65ms ต่อรอบที่ 20k กลุ่ม) — เสนอเป็น task แยก
- migration ของ index ใหม่เป็น `CREATE INDEX` (ไม่ `CONCURRENTLY`) — ล็อกการเขียนตารางระหว่างสร้าง; ตอน go-live ตารางเล็กจึงไม่มีผล
  ตารางที่ใหญ่แล้วให้รัน release ที่มี index ใหม่ช่วง traffic ต่ำ

## Backup และ restore ของ Postgres
### อะไรต้อง backup และอะไรไม่ต้อง
- **Postgres ทั้ง database `medusa`** — ทุก module ของ Medusa + custom module + ตาราง migration (`mikro_orm_migrations`, `script_migrations`)
  และ execution ของ workflow (workflow engine บันทึกลง Postgres) backup มีข้อมูลส่วนตัวของลูกค้าและ ciphertext ของ e-voucher
  → เก็บแบบเข้ารหัส สิทธิ์เข้าถึงเท่ากับ DB จริง และเก็บนอกเครื่องที่รัน DB
- **`EVOUCHER_ENCRYPTION_KEY`** — code/pin ของ e-voucher ใน DB เป็น ciphertext (spec 02) backup ไม่มี key เดิม = ถอด code ไม่ได้ทั้งหมด
  เก็บ key ใน secret manager แยกจาก backup และห้ามหมุน key โดยไม่มีแผน re-encrypt; secret อื่น (`JWT_SECRET`, `COOKIE_SECRET`,
  `AFFILIATE_TOKEN_SECRET`) เปลี่ยนได้ — ผลคือ session/token/cookie `aff` เดิมใช้ไม่ได้
- **ไฟล์** — prod ใช้ S3 (`S3_*`, หัวข้อ "ไฟล์ (S3) และ CDN" ใน `docs/ops/production.md`) ให้เปิด versioning ของ bucket ที่ provider;
  compose ที่ไม่ตั้ง `S3_*` เก็บไฟล์ในเครื่องของ container ซึ่งไม่อยู่ใน backup นี้
- **Redis ไม่ backup** — ใช้เป็น queue ของ event bus/workflow engine, cache, lock และ session store เท่านั้น (หัวข้อ "Redis modules"
  ใน `docs/ops/production.md`) ไม่มีข้อมูลที่ต้องเก็บถาวร เสียไปคือ event/job ที่ยังไม่ประมวลผล (เช่น อีเมลที่ยังไม่ส่ง) และ session (login ใหม่)
- **search index** ไม่ต้อง backup — Medusa reindex ตอนบูต (หัวข้อ "ลำดับ release")

### Backup รายวัน
- prod (managed Postgres): เปิด automated snapshot รายวันของ provider (และ point-in-time recovery ถ้ามี) — ค่าแนะนำ: เก็บ ≥ 7 วัน
- compose (`docker-compose.prod.yml`): รันบนเครื่อง host วันละครั้ง (เช่น crontab `0 19 * * *` = 02:00 เวลาไทย) แล้วคัดลอกไฟล์ออกนอกเครื่อง
  ```bash
  mkdir -p /var/backups/medusa
  docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U medusa -d medusa --format=custom --no-owner --no-acl \
    > /var/backups/medusa/medusa-$(date -u +%Y%m%dT%H%MZ).dump
  ```
  ไฟล์ format custom ถูกบีบอัดแล้ว และ `pg_dump` เป็น snapshot ที่สอดคล้องกันโดยไม่ต้องหยุดร้าน; prod ที่ DB เป็น managed ใช้ client เวอร์ชันเดียวกัน
  ได้ด้วย `docker run --rm postgres:16 pg_dump "$DATABASE_URL" --format=custom ...`
- ตรวจไฟล์ทุกครั้ง: `docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < <ไฟล์>.dump | grep -c "TABLE DATA"` ต้องไม่เป็น 0

### Restore (ซ้อมทุกครั้งก่อน go-live และหลัง bump `@medusajs/*`)
restore ลง database ใหม่ก่อนเสมอ ไม่เขียนทับ `medusa` จนตรวจผ่าน
1. หยุดรับ traffic และงานเบื้องหลัง: `docker compose -f docker-compose.prod.yml stop storefront server worker`
2. สร้าง DB ใหม่แล้ว restore:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres createdb -U medusa medusa_restore
   docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U medusa -d medusa_restore --no-owner --no-acl --exit-on-error \
     < /var/backups/medusa/<ไฟล์>.dump
   ```
3. ตรวจ: จำนวนแถวของตารางหลัก (`order`, `customer`, `evoucher_code`, `group_buy_membership`, `affiliate_commission_entry`) ใกล้เคียงกับที่คาด
   และ index ของ custom module ครบ (`docker compose -f docker-compose.prod.yml exec -T postgres psql -U medusa -d medusa_restore -c "select count(*) from pg_indexes where tablename ~ '^(affiliate|evoucher|flash_sale|group_buy)_'"`
   ได้เท่ากับ DB ต้นทาง)
4. สลับ DB (server/worker หยุดอยู่ จึงไม่มี connection ค้าง) — `DATABASE_URL` ไม่ต้องเปลี่ยน:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U medusa -d postgres \
     -c 'ALTER DATABASE medusa RENAME TO medusa_before_restore' -c 'ALTER DATABASE medusa_restore RENAME TO medusa'
   ```
   managed Postgres: restore snapshot เป็น instance ใหม่ของ provider แล้วตั้ง `DATABASE_URL` ของ server/worker/migrate ไปที่ instance นั้นแทนข้อ 2–4
5. ล้าง Redis — queue/lock/cache อ้างสถานะหลังเวลา backup ที่ไม่มีใน DB แล้ว: `docker compose -f docker-compose.prod.yml exec -T redis redis-cli FLUSHALL`
   (managed Redis: flush ผ่าน console ของ provider; ผลคือทุกคน login ใหม่)
6. บูต: `docker compose -f docker-compose.prod.yml up -d --wait server worker` — service `migrate` รันก่อน (backup จาก release เก่ากว่า image
   จะได้ migration ที่ขาดเพิ่ม) แล้วทำตามหัวข้อ "ลำดับ release" ใน `docs/ops/production.md` ข้อ 3–4 ก่อนเปิด storefront
7. ตรวจว่าร้านใช้ได้: `GET /health` = 200, `check:go-live` ผ่าน (go-live checklist ข้อ 4 ใน `docs/ops/production.md`), login admin แล้วเห็น order ล่าสุดก่อนเวลา backup
8. ข้อมูลหลังเวลา backup หายและต้องตามแก้ด้วยมือ:
   - payment ที่ Stripe รับหลังเวลา backup ไม่มี order ใน DB → ทำตามหัวข้อ "เงินถูกตัดแต่ไม่มี order (ADR-015)" ใน `docs/ops/production.md`
     (ใช้รายการ PaymentIntent ใน Stripe Dashboard ช่วงเวลานั้น)
   - e-voucher ที่ส่งอีเมลให้ลูกค้าหลังเวลา backup กลับเป็น `available` → หา code จาก log การส่งอีเมลของ Resend ช่วงนั้นแล้ว void ใน admin
     ก่อนเปิดร้าน (กันส่ง code เดิมซ้ำให้ลูกค้าคนอื่น) และ import CSV ที่ import หลังเวลา backup ใหม่
9. เก็บ `medusa_before_restore` ไว้จนยืนยันผลแล้วจึง `DROP DATABASE`

### บันทึกการซ้อม restore
| วันที่ | สภาพแวดล้อม | ผล |
|---|---|---|
| 2026-11-09 | เครื่อง dev, `postgres:16` (16.15), DB `medusa_ops5` (migration ครบ + ข้อมูลสังเคราะห์ 169 ตาราง) → `medusa_ops5_restore` | `pg_restore --exit-on-error` ผ่าน, จำนวนแถวทุกตารางตรงกัน, index ครบ 71, `db:migrate` = up-to-date, backend บูตและ `GET /health` = 200 — `docs/evidence/ops/OPS-5-restore-drill.txt` |
