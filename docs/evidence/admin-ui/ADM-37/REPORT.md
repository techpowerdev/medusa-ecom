# QA — ADM-37 คอลัมน์ข้อความของตาราง affiliate กว้างไม่เกิน 250px ทุกความกว้างจอ (PR #418)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 38" กฎ 41 และ AC-42 (a–d); Q12 = ก (คอลัมน์สุดท้ายเป็น auto)
Regression: AC-38 (ADM-33), AC-39 (ADM-34), AC-40 (ADM-35)

## commit ที่ตรวจ
- `befc72c8` — `fix(admin-ui): คอลัมน์ข้อความของตาราง affiliate กว้างไม่เกิน 250px ทุกความกว้างจอ (ADM-37)` (merge-base `dccf7a7d`)

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build:** `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9345 (`assert-absent "Development Mode"` ผ่าน)
- env ใช้ key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa418` (migrate + seed + admin user), Redis db 15, Node 22.23.3
- Playwright chromium, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`; วัดที่ 1280×800, 1440×800 และ 1920×1080
- **เทียบกับ develop:** build develop `dccf7a7d` แบบ prod ที่ port 9346 แล้วรันบน DB ชุดเดียวกัน
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #418 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-42a e2e `admin-table-long-text.spec.ts` (a1 + a2) | pass | ชุด admin เต็มผ่าน 96/96; รัน e2e ฉบับเดียวกันกับ admin ของ develop: test ใหม่ล้ม 4/4 (cell Affiliate 2579px ที่ 1280, Program 336px, Name 320px, Affiliate 2588px ที่ 1920); partners regression และ AC-40a ผ่าน |
| AC-42b `admin-table-long-text` + `admin-row-menu-escape` `--repeat-each=5` | pass | 60/60 บน prod build `workers=1` หลังรันชุด admin เต็ม (DB มีข้อมูลสะสม); static AC-38a ผ่าน 7/7 |
| AC-42c e2e admin เดิม (`admin-*`, `affiliate-admin-*`, `evoucher-admin-*`) | pass | 96/96 รวม `affiliate-admin-names` และ `affiliate-admin-tables` โดยไม่แก้ assertion |
| AC-42d payouts ที่ 1280 และ programs/affiliates/payouts ที่ 1920 | pass | `qa-01-payouts-1280-affiliate-tooltip.png`, `qa-02-programs-1920.png`, `qa-03-affiliates-1920.png` |

## ผลวัด (PR เทียบ develop) — ความกว้าง td (px), ✂ = ข้อความถูกตัด
| จอ | ตาราง | develop | PR | ปุ่ม `…` (right / ช่องว่างหลังปุ่ม) develop → PR |
|---|---|---|---|---|
| 1280 | programs | Program 298✂ … Hold days 106 | Program 298✂ … Hold days 86 | 667/55 → 673/64 |
| 1280 | affiliates | Name 298✂, Email 274✂ (ตาราง 1090) | เท่าเดิม | 1138/24 → 1138/24 |
| 1280 | payouts | ตาราง **3744**, Affiliate **2600** | ตาราง 1418, Affiliate 274✂ | 348/24 → 348/24 |
| 1440 | programs / affiliates / payouts | ข้อความ ≤ 250 (ยกเว้น Affiliate ของ payouts 2600) | ข้อความทุกคอลัมน์ ≤ 250 | ปุ่มในจอทุกตาราง |
| 1920 | programs | Program **384**, ทุกคอลัมน์ ~193–209 | Program 298✂, actions 150, Hold days **504** (auto) | 888/165 → 758/122 |
| 1920 | affiliates | Name **370**, Email **340**, Code 294 | Name 298✂, Email 274✂, Code 237, Joined **467** (auto) | 1501/158 → 1269/122 |
| 1920 | payouts | Affiliate **2600** | Status 130, actions 118, Affiliate 274✂, Amount 125, Reference 274✂, Payout 293 | 398/24 → 440/90 |

- `scrollLeft` = 0 และ `documentElement.scrollWidth` = ความกว้างจอ ทุกกรณี
- ค่าในตารางคือความกว้าง td (รวม padding) เนื้อหาไม่รวม padding ≤ 250px ทุกคอลัมน์ข้อความ

## checklist จาก builder
- [x] **payouts ที่ 1280 ตัดชื่อ affiliate ยาวที่ขอบ cell** — td 274px ไม่มี "…" ตามกฎ 41b (ยอมรับ)
- [x] **tooltip ของ payouts เป็น "ชื่อ อีเมล"** — hover แล้วข้อความตรงกับ `` `${ชื่อ} ${อีเมล}` `` ทุกตัว; บน develop cell ไม่ถูกตัดจึงไม่มี tooltip
- [x] **ปุ่ม `…` ของ payouts อยู่ในจอ** — right 348
- [x] **ที่ 1920 คอลัมน์ข้อความ ≤ 250px ทั้ง 3 ตาราง**
- [x] **ช่องว่างส่วนเกินอยู่ที่คอลัมน์สุดท้าย** ใน programs (Hold days 504) และ affiliates (Joined 467) ไม่อยู่หลังปุ่ม
  - ช่องว่างหลังปุ่ม 122px คือความกว้างเริ่มต้น 150 ของคอลัมน์ actions ซึ่งน้อยกว่า develop (165/158)
- [x] **ข้อความสั้นแสดงเต็มไม่ถูกตัด** (`qP-…`, `qA-…`, `…@shop.th`, `R-…`)
  - ความกว้างคอลัมน์ที่ 1280 ของ affiliates และ payouts เท่า develop ทุกคอลัมน์
  - programs ต่างกัน 5–20px เพราะ Hold days เป็น auto — หน้าตาเท่าเดิม
- [x] **Ledger (ใช้ `AffiliateCell` ร่วม) ไม่มีช่องว่างเกินระหว่างชื่อกับอีเมล**
  - PR: element ชื่อและอีเมลอยู่ตำแหน่งเดียวกับ develop (ขอบล่างของชื่อ = ขอบบนของอีเมล, ชิดซ้ายเท่ากัน, cell สูง 42px)
  - ต่างกันแค่มี text node ช่องว่างเพิ่ม 1 ตัว (childNodes 3 เทียบ 2)
- [x] **ADM-33 Escape ครั้งเดียวปิดเมนู** — `admin-row-menu-escape` ผ่าน 25/25 ใน `--repeat-each=5`
- [x] **ADM-34 focus กลับปุ่ม** — `admin-modal-return-focus` ผ่าน (อยู่ในชุด 96 ข้อ)
- [x] **ADM-35 partners ยังถูก** — AC-40a และ partners regression ที่ 1920 ผ่าน

## negative / edge case (PR ที่ 1280)
- **ชื่อสั้น + อีเมลยาวอย่างเดียว:** cell 274px ถูกตัด, tooltip = "ชื่อ อีเมล"
- **payout ของ affiliate ที่หาไม่เจอ:** แสดง `affiliate_id` ยาว 90 ตัว cell 274px ถูกตัด และปุ่ม `…` อยู่ในจอ
- **e2e ใหม่บน DB ที่มีข้อมูลสะสม:** ผ่านครบ 5 รอบ ไม่ flaky

## defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
- **O-1: payouts ที่ 1920 คอลัมน์สุดท้าย "Payout" ไม่ได้รับส่วนเกิน**
  - คอลัมน์นี้กว้างเท่าเนื้อหา (293px)
  - ส่วนเกินไปที่ Status, actions และ Amount ซึ่งยังกว้างไม่ถึงค่าเริ่มต้น 150 (130/118/125) เพราะตารางกว้างพอดีเนื้อหา
  - ช่องว่างหลังปุ่มจึงเป็น 90px (ที่ 1280 เป็น 24px) ไม่เกินความกว้างเริ่มต้นของคอลัมน์ ตรงกับผลวัดของ builder ใน `ADM-37-tests.txt`
- **O-2: คอลัมน์ Affiliate ของ Ledger ยังกว้าง 2600px ทุกความกว้างจอ (ตาราง 3203px)** ทั้งบน develop และ PR
  - spec รอบ 38 ระบุว่าอยู่นอกขอบเขต และ Ledger ไม่มีเมนูต่อแถว จึงไม่มีปุ่มถูกดันออกนอกจอ
  - แต่ Status ต้องเลื่อนแนวนอนถึงจะเห็น — ควรเปิด follow-up ถ้าต้องการ
- **O-3: tooltip ของชื่อไทยปนอังกฤษที่ไม่มีช่องว่างสูงมาก** (เหมือน #416 O-4) อ่านได้ครบ

## evidence (3 รูป, PNG, ไม่เกิน 199KB)
- `qa-01-payouts-1280-affiliate-tooltip.png` — payouts ที่ 1280: ชื่อและอีเมลของ affiliate ยาวถูกตัดที่ 274px, tooltip "ชื่อ อีเมล", ปุ่ม `…` อยู่ในจอ, แถว `qA-…` / `R-…` แสดงเต็ม
- `qa-02-programs-1920.png` — programs ที่ 1920: ชื่อยาวถูกตัด, ปุ่มชิดคอลัมน์ Status เหมือนเดิม, ช่องว่างส่วนเกินอยู่ที่ Hold days (คอลัมน์สุดท้าย)
- `qa-03-affiliates-1920.png` — affiliates ที่ 1920: Name/Email ยาวถูกตัด, ปุ่ม `…` อยู่ในจอ, ช่องว่างส่วนเกินอยู่ที่ Joined (คอลัมน์สุดท้าย)
