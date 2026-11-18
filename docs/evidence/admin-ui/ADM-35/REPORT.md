# QA — ADM-35 ข้อความยาวใน `DataTable` ไม่ดันปุ่ม `…` ออกนอกจอ (PR #416)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 37" กฎ 39 และ AC-40 (a–d) ตามการตีความของ session หลัก 2026-11-18 ใน body ของ PR
Regression: AC-38 (ADM-33), AC-39 (ADM-34)

## commit ที่ตรวจ
- `8d77ae1e` — `fix(admin-ui): ข้อความยาวในตาราง DataTable ไม่ดันปุ่ม … ออกนอกจอ + nit e2e ของ #409 (ADM-35)` — รอบแรก (merge-base `e1973af0`)
- `8814b317` — merge `origin/develop` และแก้ e2e ตาม D-1 — รอบซ้ำ (`src/admin/components` ไม่ต่างจาก `8d77ae1e`)

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build:** `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9342 ไม่มีคำ "Development Mode" ใน asset
- env ใช้ key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa416` (migrate + seed + admin user; รอบซ้ำสร้างใหม่), Redis db 12, Node 22.23.3
- Playwright chromium 1280×800 (ตรวจเพิ่มที่ 1440 และ 1920), `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`
- **เทียบกับ develop:** build develop แบบ prod แล้วรันบน DB ชุดเดียวกัน (รอบแรก `46391372`, รอบซ้ำ `a00bec61`)
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #416 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-40a e2e `admin-table-long-text.spec.ts` | pass (รอบซ้ำ `8814b317`) | ชุด admin เต็มบน DB ใหม่ผ่าน 91/91; `--repeat-each=5` บน DB ที่มีข้อมูลสะสม (pool 22 แถว ตาราง partners อยู่ใต้จอ) ผ่าน 10/10 สองรอบ; รัน e2e ฉบับเดียวกันกับ admin ของ develop ล้ม 2/2 ที่ `toBeInViewport` ("viewport ratio 0") |
| AC-40b `admin-row-menu-escape` `--repeat-each=5` | pass | 25/25 บน prod build workers=1 (DB มีข้อมูลสะสม) |
| AC-40c e2e admin เดิม | pass | `admin-*`, `affiliate-admin-*`, `evoucher-admin-*` ผ่าน 91/91 ในรอบซ้ำ |
| AC-40d 4 ตารางที่ 1280 ข้อความยาวและสั้น | pass | `qa-01-partners-1280-tooltip.png`, `qa-02-affiliates-1280-tooltip.png`, `qa-03-payouts-1280-tooltip.png` |

## ผลวัดที่ 1280 (PR เทียบ develop)
| ตาราง | develop: ตาราง / ปุ่ม | PR: ตาราง / ความกว้าง cell / ปุ่ม right |
|---|---|---|
| partners | 5597px ต้อง `scrollLeft` 4537; ปุ่มถูก cell sticky บัง คลิกไม่ได้ | 1036px / [298, 274, 464] / 832 |
| programs | 3296px ต้อง `scrollLeft` 1716; คลิกไม่ได้ | 1036px / ชื่อ 298 / 665 |
| affiliates | 4155px ต้อง `scrollLeft` 2929; คลิกไม่ได้ | 1141px / [298, 274, …] / 1183 |
| payouts | ปุ่มอยู่คอลัมน์ 2 (อยู่ในจอเดิม); reference กว้าง 2200px ไม่มี tooltip | reference 274 ถูกตัด tooltip ข้อความเต็ม / 348 |

## checklist จาก builder
- [x] **ปุ่ม `…` อยู่ในจอ** ทั้ง 4 ตารางที่ 1280, 1440, 1920 โดย `scrollLeft` = 0 และ `documentElement.scrollWidth` = ความกว้างจอ
- [x] **tooltip ข้อความเต็ม** — hover cell ที่ถูกตัดแล้วตรงกับข้อความเต็ม 6/6 กรณี:
  - ชื่อ partner และ support contact ที่เป็น URL ยาว
  - ชื่อ program
  - ชื่อและอีเมลของ affiliate
  - reference ของ payout
- [x] **ข้อความหลายแบบ** — ไทยปนอังกฤษไม่มีช่องว่าง 370 ตัว, ไทยมีช่องว่าง 370 ตัว, URL ยาว และอีเมล 139 ตัว ถูกตัดทั้งหมด
- [x] **ข้อความสั้น** (`0qS-…`, `line@shop`, `qP-…`, `qA-…`, `R-…`) แสดงเต็ม ไม่ถูกตัด (`scrollWidth ≤ clientWidth`)
- [x] **ตำแหน่งปุ่ม** — ชิดซ้ายของคอลัมน์ actions (offset 0) เหมือน develop; คอลัมน์ actions ของ partners กว้างขึ้นเป็น 464px ตามการตีความ
- [x] **เมาส์** — คลิก `…` แล้ว Escape ครั้งเดียวปิดทุกตาราง (ADM-33) และ focus กลับมาที่ trigger
- [x] **คีย์บอร์ด** — Tab ไปถึงปุ่ม `…` โดยปุ่มอยู่ในจอ → Enter เปิด → Escape ครั้งเดียวปิด → focus กลับ trigger ไม่มี tooltip ค้างที่ trigger
- [x] **ADM-34** — `admin-modal-return-focus` ผ่าน (อยู่ในชุด 91 ข้อ)

## defect
- **D-1 (test-only) — แก้แล้วใน `8814b317`**
  - **อาการเดิมที่ `8d77ae1e`:** test partners ใน `e2e/admin-table-long-text.spec.ts` ผลขึ้นกับข้อมูลใน DB
    - ตาราง partners อยู่ใต้ตาราง E-voucher pools พอ pool เกินประมาณ 12 แถว `toBeInViewport()` ล้มเพราะอยู่นอกจอแนวตั้ง (ล้ม 5/5)
    - `page.mouse.move(0, 0)` ลากผ่าน sidebar จน tooltip "Products G then P" ขึ้น แล้ว `getByRole("tooltip")` `toHaveCount(0)` ล้ม
  - **ที่แก้:**
    - เลื่อน cell ชื่อเข้าจอแนวตั้งด้วย `scrollIntoView({ block: "center", inline: "start" })` ก่อนตรวจ โดยยังตรวจ `scrollLeft === 0` และ `x + width ≤ 1280`
    - ตรวจเฉพาะ tooltip ของ cell (กรองด้วยชื่อเต็ม)
    - เลื่อนเมาส์ออกภายในคอลัมน์เดิม ไปทิศตรงข้ามกับ tooltip
  - **วิธี re-test:**
    - ชุด admin เต็มบน DB ใหม่: 91/91
    - `--repeat-each=5` บน DB สะสม (pool 22 แถว): 10/10
    - เติม pool โดยเจตนาแล้วรันซ้ำ: 10/10
    - บังคับให้ tooltip ของ sidebar ขึ้นแล้วลากเมาส์ไปที่ cell แบบผู้ใช้: tooltip ของ sidebar ปิด และขั้นตอนของ test ผ่าน 5/5
    - รันกับ admin ของ develop: ล้ม 2/2 ที่ `toBeInViewport` (ยังจับบั๊กได้)

## ข้อสังเกต (ไม่บล็อก)
- **O-1:** คอลัมน์ Affiliate ของ payouts (`AffiliateCell`) ไม่จำกัดความกว้าง
  - ชื่อ affiliate 370 ตัวทำให้ตารางกว้าง 3759px
  - ปุ่ม `…` ยังอยู่ในจอเพราะอยู่คอลัมน์ 2 แต่ reference ต้องเลื่อนแนวนอนถึงจะเห็น
  - อยู่นอกรายการของกฎ 39a ควรเปิด follow-up
- **O-2:** ที่ 1280 บางตารางกว้างเกินกล่อง 1036px อยู่แล้วแม้ไม่มีข้อความยาว:
  - affiliates กว้าง 1141px เพราะคอลัมน์ code
  - payouts กว้าง 1490px เพราะมี 8 คอลัมน์
  - ปุ่ม `…` ยังอยู่ในจอทั้งสองตาราง
- **O-3:** ที่ 1920 คอลัมน์ข้อความกว้างเกิน 250px: ชื่อ program 381px, ชื่อ affiliate 364px, อีเมล 334px — ตรงกับที่ builder แจ้งไว้ใน "นอกขอบเขต" ปุ่มยังอยู่ในจอ
- **O-4:** tooltip ของข้อความไทยปนอังกฤษที่ไม่มีช่องว่างตัดบรรทัดตามขอบคำไทย จึงสูงประมาณ 20 บรรทัด แต่อ่านได้ครบ
- **O-5:** ถ้า Playwright กระโดดเมาส์ครั้งเดียว (`hover()`) จากลิงก์ใน sidebar ไปที่ cell tooltip ของ sidebar จะค้าง และ tooltip ของ cell จะไม่ขึ้น แต่ถ้าลากหลายจังหวะแบบผู้ใช้จริง tooltip ปิดปกติ — e2e ใหม่ไม่ควรผ่าน sidebar

## evidence (3 รูป, PNG 1280×800, ไม่เกิน 191KB)
- `qa-01-partners-1280-tooltip.png` — partners ชื่อยาว 370 ตัวและ support contact เป็น URL ยาว: ทั้งสองถูกตัด, tooltip ชื่อเต็ม, ปุ่ม `…` (focus ring หลังปิดเมนูด้วย Escape) อยู่ในจอ, แถว `0qS-…` / `line@shop` แสดงเต็ม
- `qa-02-affiliates-1280-tooltip.png` — affiliate ชื่อ 370 ตัวและอีเมล 139 ตัวถูกตัด, tooltip ชื่อเต็ม, ปุ่ม `…` อยู่ในจอ, แถว `qA-…` แสดงเต็ม
- `qa-03-payouts-1280-tooltip.png` — reference ยาว 317 ตัวถูกตัดที่ 250px, tooltip ข้อความเต็ม, ปุ่ม `…` อยู่ในจอ (`scrollLeft` 0)
