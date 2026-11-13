# QA — ADM-17 (PR #360): ค้น affiliate ด้วย `q` + `useComboboxData` ในฟอร์ม payout

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-17, กฎ 21, AC-21 (regression AC-12)
- Commit ที่ตรวจ (branch `feat/ADM-17-affiliate-search`)
  - รอบ 1: `5184de48279880f1280a447f9bd30cb3847dd7aa` เจอ D-1
  - รอบ 2 (re-test): `1d86183dfc31616bb1fd8b532023d5b915873da2` แก้ D-1 ด้วย middleware `tiebreakById` (ต่อ `id` เป็นตัวเรียงที่สองของ list route affiliate ทั้ง 4 คือ programs, affiliates, entries, payouts)
- สภาพแวดล้อม: backend prod build (`medusa start` จาก `.medusa/server`) ที่ :9260 พร้อม admin, DB แยก (สร้างใหม่ + migrate + seed), Redis db 11, Node 22, Chromium 1280×800, `Asia/Bangkok`
- ข้อมูล: สร้างผ่าน API ได้แก่ `QaAct` active 63, `QaSus` suspended 7, `QaPend` pending 3 (email ตัวพิมพ์ปน `…@QaMail.Example.com`) และใส่ตรงใน DB ที่ `created_at` เท่ากัน (จำลอง bulk import) ได้แก่ `QaTie` affiliate 120 ราย (active 96 / suspended 24) และในรอบ 2 เพิ่ม program 120, commission entry 120, payout 120
- CI
  - รอบ 2: https://github.com/techpowerdev/medusa-ecom/actions/runs/43397414898 (head `1d86183d`) Playwright report/trace ฉบับเต็มเป็น artifact ของ run นี้ เก็บ 14 วัน
  - รอบ 1: https://github.com/techpowerdev/medusa-ecom/actions/runs/43393013474 (head `5184de48`, success)

## ตาราง AC (รอบ 2, `1d86183d`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-21 route: `q` ค้น `name`/`email` แบบไม่สนตัวพิมพ์, ใช้ร่วมกับ `status` ได้, ไม่ตรง = 0, ไม่ล็อกอิน = 401 | pass | รอบ 1 ตรวจด้วย curl และรอบ 2 ตรวจซ้ำผ่าน QA-1 ไม่ล็อกอินได้ 401 |
| AC-21 e2e: ค้นฝั่ง server ด้วย `q`, ไม่มี `limit=200`, เลือกได้และ POST ถูกต้อง | pass | `ac21-search-case-insensitive.png`; e2e `affiliate-admin-forms.spec.ts:158` และ QA-1 ผ่านทั้ง 5 รอบ |
| AC-21 e2e: GET รายชื่อล้ม → error ใต้ช่อง | pass | `ac21-options-error.png` (abort ได้ "Could not load affiliates: Failed to fetch" สี rgb(225,29,72)); e2e `:214` (500) ผ่าน |
| AC-21 nit: option ของ collection นอกหน้าแรกเป็น `aria-selected="true"` + assert 200 | pass | e2e `affiliate-admin-forms.spec.ts:47` และ `:122` ผ่าน |
| AC-12 (regression): ฟอร์มสร้าง payout ค่าเริ่มต้น, สร้างสำเร็จ, กันกดซ้ำ | pass | `ac12-payout-created.png`; QA-6 กด dblclick + click ได้ POST เดียว (200), toast "Payout created", มี payout ใหม่ 1 แถวใน DB |

## Checklist ของ PR (1280×800, Affiliate → Payouts → Create payout)

| รายการ | รอบ 1 | รอบ 2 | หมายเหตุ |
|--------|-------|-------|----------|
| ค้นชื่อ/อีเมลพิมพ์เล็กใหญ่ปน (`qAsUs pArTnEr 003`, `QAACT-010@QAMAIL`) | pass | pass | ได้ 1 รายการที่ตรง และ request มี `q=` ตามที่พิมพ์ |
| เลื่อนลงสุดโหลดทุกหน้า (63 active vs 7 suspended, `q=Partner`) | pass | pass | 70 option ไม่ซ้ำไม่หาย; request `offset` 0–60 ทีละ 10 ทั้งสองสถานะ (`ac21-scroll-all-pages.png`) |
| เลื่อนลงสุดเมื่อ `created_at` เท่ากัน (96 active vs 24 suspended, `q=QaTie`) | **fail** | pass | รอบ 1 ได้ 120 option แต่ไม่ซ้ำแค่ 117 (D-1) รอบ 2 ได้ 120 ไม่ซ้ำ 120 ไม่หาย ผ่านทั้ง 5 รอบที่รัน (`qa3-tie-fixed.png`) |
| ชื่อที่เลือก (อยู่นอกหน้าแรก) ยังแสดงหลังค้นคำอื่น/ปิด popover | pass | pass | QA-4 |
| suspended มีป้าย " — suspended", ไม่มี pending | pass | pass | QA-1/QA-2 |
| บล็อก request รายชื่อ → ข้อความแดงใต้ช่อง (`affiliate-payout-options-error`) | pass | pass | QA-5 |
| สร้าง payout สำเร็จ และกดซ้ำไม่ได้ | pass | pass | QA-6 |
| ฟอร์มแก้โปรแกรม: collection นอกหน้าแรกขึ้นเป็นถูกเลือก | pass | pass | e2e `:47` |

## Re-test D-1 ระดับ API (รอบ 2) — เดินทุกหน้าด้วย `limit`/`offset`

ข้อมูล tie: affiliate 120 + program 120 + entry 120 + payout 120 ที่ `created_at = 2026-10-01T00:00:00Z` เท่ากันหมด

| route | query | limit 7 / 10 / 50 | เรียง |
|-------|-------|-------------------|-------|
| affiliates | (ไม่มี) | 193/193 ไม่ซ้ำ | `-created_at, -id` ถูกต้อง |
| affiliates | `q=QaTie&status=active` / `suspended` | 96/96, 24/24 ไม่ซ้ำ | ถูกต้อง |
| affiliates | `order=name` / `order=-name` / `order=created_at` | 193/193 ไม่ซ้ำ | `name, id` / `-name, -id` / `created_at, id` ถูกต้อง |
| programs | (ไม่มี) / `order=name` | 120/120 ไม่ซ้ำ | ถูกต้อง |
| entries | (ไม่มี) | 120/120 ไม่ซ้ำ | ถูกต้อง |
| payouts | (ไม่มี) | 120/120 ไม่ซ้ำ | ถูกต้อง |

- จำลอง `useComboboxData` + `mergeAffiliatePages`: `q=QaTie` ได้ 120 ไม่ซ้ำ 120, `q=''` ได้ 190 ไม่ซ้ำ 190 (รอบ 1 ซ้ำ 10), `q=Partner` ได้ 70 ไม่ซ้ำ 70
- `order=id` / `order=-id` ใช้ได้ (middleware ไม่ต่อ `id` ซ้ำ); `order=name&order=status` ได้ 400 (validator เดิม); ไม่ล็อกอินได้ 401

## Regression ตาราง admin affiliate (รอบ 2)

| รายการ | Result | หมายเหตุ |
|--------|--------|----------|
| QA-7 ตาราง Programs / Affiliates / Ledger / Payouts (หน้า 20 แถว) กด Next จนหน้าสุดท้าย | pass | ทุกแท็บได้ id ครบตาม `count` ไม่ซ้ำ จำนวนแถวต่อหน้าตรง และเรียง `-created_at, -id` ผ่านทั้ง 5 รอบ |
| e2e affiliate admin ที่มีอยู่: `affiliate-admin-tables`, `-programs`, `-affiliates`, `-payouts`, `-payout-create`, `-row-actions`, `-names` | pass | 10 passed บน DB ที่มีข้อมูล tie |

## API edge case — `GET /admin/affiliate/affiliates` (รอบ 1)

| กรณี | ผล |
|------|-----|
| ไม่ล็อกอิน (มี/ไม่มี `q`) | 401 |
| `q=` (ว่าง) | 200 คืนทั้งหมด (73) |
| `q=%` / `q=_` / `q=a_t` | 200 คืนทั้งหมด (73) — wildcard ของ `ILIKE` (O-1) |
| `q=\` , `q='` , `q=';drop` | 200, 0 รายการ ไม่มี error |
| `q[]=a` | 400 `Expected type: 'string' for field 'q'` |
| `q` ยาว 5,000 / 15,000 ตัว | 200, 0 รายการ |
| `q` ยาว 100,000 ตัว | 431 (จาก Node) server ยัง healthy |

## Defect

| ID | ระดับ | รอบ 1 (`5184de48`) | รอบ 2 (`1d86183d`) |
|----|-------|--------------------|--------------------|
| D-1 รายการ affiliate ในฟอร์ม payout ซ้ำ/หายเมื่อ `created_at` เท่ากัน | กลาง | open | **fixed** |

D-1 (รอบ 1): ทำซ้ำ — affiliate (active+suspended) > 10 รายที่ `created_at` เท่ากัน → Create payout → พิมพ์คำที่ match ทั้งกลุ่ม → เลื่อนลงสุด; Expected 120 ราย ครั้งเดียว; Actual 120 option ไม่ซ้ำ 117 (ซ้ำ 3, หาย 3) และ API ตรง `limit=10&offset=…` ก็ซ้ำ; สาเหตุ: list route เรียง `-created_at` อย่างเดียว ไม่มีตัวตัดสิน
D-1 (รอบ 2): QA-3 ผ่าน 5/5 รอบ และ API ทั้ง 4 route ที่ limit 7/10/50 ไม่ซ้ำไม่หาย เรียงคงที่ ไม่พบ defect ใหม่

## ข้อสังเกต (ไม่ block)
- O-1: `q` ไม่ escape `%`/`_` — พฤติกรรมเดียวกับ `.searchable()` ของ Medusa core ไม่มีผลด้านความปลอดภัย
- O-2: กด Escape ตอน combobox เปิด ปิดทั้ง FocusModal (สิ่งที่กรอกหาย) — มาจาก Combobox/FocusModal ของ ADM-9
- O-3: option เรียงตามชื่อเฉพาะภายในหน้าเดียวกัน ทั้งรายการไม่ได้เรียงต่อเนื่อง
- O-4: access log บันทึก `q` เต็มความยาว
- O-5: `order=foo` หรือ `order=` ได้ 500 — มีก่อน PR และ route ของ Medusa core เป็นแบบเดียวกัน

## Test ที่รัน (local)
- รอบ 1: `affiliate-admin-forms.spec.ts` 4 passed; QA spec (ไม่ commit) QA-1,2,4,5,6 passed, QA-3 failed (D-1)
- รอบ 2: QA spec (QA-1..QA-7) + `affiliate-admin-forms.spec.ts` 5 รอบ — รอบ 1/4/5 ได้ 14 passed; รอบ 2/3 QA-6 ล้มเพราะ assertion ของ QA นับ payout สะสมข้ามรอบ (POST ยังเป็นครั้งเดียว) แก้ assertion แล้วผ่าน; QA-3 ผ่าน 5/5; e2e affiliate admin อื่น 10 passed
