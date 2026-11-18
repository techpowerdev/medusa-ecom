# QA — ADM-38 ตาราง Ledger คอลัมน์ Affiliate กว้างไม่เกิน 250px ทุกความกว้างจอ (PR #421)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 39" กฎ 42 และ AC-43 (a–d); ที่มา qa #418 O-2
Regression: AC-38 (ADM-33), AC-40 (ADM-35), AC-42 (ADM-37)

## commit ที่ตรวจ
- `b5d1da97` — `feat(admin-ui): ตาราง Ledger คอลัมน์ Affiliate กว้างไม่เกิน 250px + Status เป็นคอลัมน์ auto (ADM-38)` (merge-base `678dc990`)

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build:** `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9348 (`assert-absent "Development Mode"` ผ่าน)
- env ใช้ key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa421` (migrate + seed + admin user), Redis db 4, Node 22.23.3
- Playwright chromium, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`; วัดที่ 1280×800, 1440×800 และ 1920×1080
- **เทียบกับ develop:** build develop `678dc990` แบบ prod ที่ port 9349 แล้วรันบน DB ชุดเดียวกัน
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #421 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-43a e2e `admin-table-long-text.spec.ts` (a1 1280 + a2 1920) | pass | ผ่านในชุด admin เต็ม; รันบน develop แล้วล้ม 2/2 (develop ไม่มี wrapper testid จึงล้มที่ locator — red ขั้น (1) ของ builder อยู่ใน `ADM-38-tests.txt`); probe ของ qa บน develop วัดเนื้อหา cell Affiliate ได้ 2590px ทุกจอ |
| AC-43b `admin-table-long-text` + `admin-row-menu-escape` `--repeat-each=5` | pass | 70/70 บน prod build `workers=1` หลังรันชุด admin เต็ม (DB มีข้อมูลสะสม) |
| AC-43c e2e admin เดิม (`admin-*`, `affiliate-admin-*`, `evoucher-admin-*`) | pass | 98/98 รวม `affiliate-admin-names`, `affiliate-admin-tables`, กรณี ledger error ของ `affiliate-admin-forms` โดยไม่แก้ assertion |
| AC-43d Ledger ที่ 1280 (ตัด, tooltip, เห็น Status) และ 1920 (≤ 250px, ส่วนเกินท้ายตาราง), ชื่อสั้นแสดงเต็ม | pass | `qa-01-ledger-1280-long-affiliate-tooltip.png`, `qa-02-ledger-1920-status-auto.png` |

## ผลวัด (PR เทียบ develop) — ความกว้าง td (px) Created / Affiliate / Order / Amount / Status, ✂ = ข้อความถูกตัด
| จอ | develop | PR | Status right (px) / ล้นแนวนอนของกล่องเลื่อน (px) develop → PR |
|---|---|---|---|
| 1280 | 185 / **2614** / 201 / 74 / 88 (ตาราง 3163) | 185 / 274✂ / 253 / 150 / 174 (ตาราง 1036) | 3395 / 2127 → 1268 / 0 |
| 1440 | 185 / **2614** / 201 / 74 / 88 (ตาราง 3163) | 185 / 274✂ / 253 / 150 / **334** (auto) | 3395 / 1967 → 1428 / 0 |
| 1920 | 185 / **2616** / 201 / 74 / 88 (ตาราง 3164) | 185 / 274✂ / 233 / 150 / **734** (auto) | 3446 / 1588 → 1858 / 0 |

- PR: เนื้อหา cell Affiliate (ไม่รวม padding) = 250px ทุกจอ, `scrollLeft` = 0 และ `documentElement.scrollWidth` = ความกว้างจอ ทุกกรณี
- Order ลดจาก 253 เป็น 233 ที่ 1920 เพราะเนื้อหาของหน้าต่างกัน (order id คนละชุด) ไม่ใช่ผลของการแก้

## checklist จาก builder
- [x] **1280: ชื่อ affiliate ยาวถูกตัด** — td 274px, `.truncate` scrollWidth > clientWidth
- [x] **tooltip "ชื่อ อีเมล"** — hover แล้วข้อความตรงกับ `` `${ชื่อ} ${อีเมล}` `` ทั้งที่ 1280, 1440 และ 1920
- [x] **เห็น Status โดยไม่เลื่อนแนวนอน** — right ของ Status 1268 ≤ 1280, `scrollLeft` = 0
- [x] **1920: คอลัมน์ Affiliate ≤ 250px** และช่องว่างส่วนเกินอยู่ที่ Status (คอลัมน์สุดท้าย 734px)
- [x] **affiliate ชื่อสั้นแสดงชื่อและอีเมลเต็มเหมือนเดิม**
  - เช่น `S-…` / `qs-…@shop.th` ไม่ถูกตัด
  - hover แล้วไม่มี tooltip ของ cell

## เพิ่มเติม
- **1440:** ผลเหมือน 1280 — Affiliate 274✂, Status auto 334, ไม่ล้น
- **สลับแท็บ Programs → Payouts → Affiliates → Ledger → Programs → Ledger:**
  - ตาราง Ledger render ใหม่ถูกต้อง มี wrapper `affiliate-ledger-table` ตัวเดียวใน DOM
  - ตาราง Programs ไม่แสดงขณะอยู่แท็บ Ledger
  - ความกว้างยังเป็น 274/250 และ Status right 1268
- **แบ่งหน้า `ledger_offset` (57 entries):**
  - `?ledger_offset=40` ได้ 17 แถว ตรงกับจำนวนที่ควรได้ แถวแรกยังถูกจำกัด 274
  - กด Prev ได้ `?ledger_offset=20`
- **ADM-33/35/37 regression:**
  - `admin-row-menu-escape` ผ่านใน `--repeat-each=5`
  - AC-40a และ AC-42a1/a2 ผ่านทั้งในชุดเต็มและการรันซ้ำ

## negative / edge case (PR)
- **ชื่อสั้น + อีเมลยาวอย่างเดียว:** cell 274px ถูกตัด, tooltip = "ชื่อ อีเมล" (ตรวจบนหน้าที่เพิ่งโหลด)
- **entry ของ affiliate ที่หาไม่เจอ:** แสดง `affiliate_id` ยาว 90 ตัว ถูกตัดที่ 274px และ Status อยู่ในจอ
- **`?ledger_offset=abc`:** param หายจาก URL และแสดงหน้าแรก 20 แถว
- **`ledger_offset` เกินจำนวนแถว:** ปรับเป็นหน้าสุดท้าย `?ledger_offset=40` ได้ 17 แถว ไม่มี NaN
- **e2e ใหม่บน DB ที่มีข้อมูลสะสม:** ผ่านครบ 5 รอบ ไม่ flaky

## defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
- **O-1: tooltip ของชื่อ 370 ตัวอักษรสูงมาก** บังหลายแถวที่ 1280 (เหมือน #418 O-3 / #416 O-4) อ่านได้ครบ
  - ใน probe ของ qa การ hover cell ถัดไปทันทีหลัง tooltip นี้ไม่เปิด tooltip ใหม่ภายใน 5 วินาที
  - เมื่อ hover บนหน้าที่เพิ่งโหลดจะเปิดถูกต้อง จึงน่าจะเป็นพฤติกรรม grace area ของ Radix หรือ cell ที่ถูก tooltip บัง (แบบ qa #416 O-5) ไม่ได้มาจากการแก้นี้

## evidence (2 รูป, PNG, ไม่เกิน 238KB)
- `qa-01-ledger-1280-long-affiliate-tooltip.png` — Ledger ที่ 1280: ชื่อและอีเมลของ affiliate ยาวถูกตัดที่ 274px, tooltip "ชื่อ อีเมล", เห็นคอลัมน์ Status ในจอ, แถวชื่อสั้นแสดงเต็ม
- `qa-02-ledger-1920-status-auto.png` — Ledger ที่ 1920: คอลัมน์ Affiliate ≤ 250px (ยาวถูกตัด, สั้นแสดงเต็ม), ช่องว่างส่วนเกินอยู่ที่คอลัมน์ Status (คอลัมน์สุดท้าย)
