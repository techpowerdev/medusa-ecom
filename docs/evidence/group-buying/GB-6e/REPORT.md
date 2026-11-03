# QA GB-6e — แคมเปญ group buy ต้องมีสินค้าเดียว (PR #231)

- Spec: `docs/spec/04-group-buying.md` กฎข้อ 30, AC-49, AC-50 · commit `f510171`
- สภาพแวดล้อม: backend prod build (`medusa build` แล้ว `medusa start`) port 9231, DB แยก, Redis db แยก, Playwright chromium, admin locale `en-US` + `Asia/Bangkok` (ADR-018), หา element ด้วย `data-testid`
- Stripe: flow นี้ไม่ได้เรียกใช้ ตั้งเป็น key dummy `sk_test_…` ไม่มี live key
- CI ของ PR (run 41681446262): ทุก job `pass` รวม `storefront-e2e` และ `backend (http 1–3/3)` Playwright report และ trace ฉบับเต็มอยู่ใน artifact ของ run นี้

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-49 (30a) POST สินค้าเดียว → สำเร็จ; 2 สินค้า / `values: []` / ไม่มี `target_rules` / `target_rules: []` / ระดับ variant → 400 `invalid_data` + `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` และจำนวน campaign/promotion ไม่เปลี่ยน | pass (ดู O-1) | เคสผิดทั้ง 9 เคสได้ `400 invalid_data` ข้อความมี code จำนวน promotion, Medusa campaign และ GB campaign ก่อน-หลังเท่ากัน สินค้าเดียวได้ 200 |
| AC-49 (30a) เรียก `createGroupBuyCampaignWorkflow` ตรงด้วย 2 สินค้า | pass (จาก CI) | integration `group-buy-campaigns.spec.ts` ผ่านใน CI |
| AC-49 (30b) draft ที่ต้นแบบถูกแก้เป็น 2 สินค้า → activate ได้ 400 และยังเป็น draft | pass | แก้ต้นแบบผ่าน `POST /admin/promotions/:id/target-rules/batch` แล้ว activate ได้ `400 not_allowed` + code และ status ยังเป็น `draft` |
| AC-49 (30b) active ที่ต้นแบบถูกแก้ → admin `POST …/groups` และ store `POST /store/group-buy/groups` ได้ 400 + code โดยไม่มี `GB-*` ใหม่ | pass | ทั้งสองทางได้ `400 not_allowed` + code จำนวน promotion `GB-` ไม่เปลี่ยน กลุ่มที่สร้างก่อนแก้ยัง `open` |
| AC-49 กลุ่มที่สร้างก่อนแก้ยัง join ได้ 201 | pass (จาก CI) | `group-buy-join.spec.ts` ผ่านใน CI |
| AC-49 `load-seed.spec.ts` + gate ของ OPS-4 | pass (จาก CI) | `backend (http)` ผ่าน และ load-nightly run 41681456107 |
| AC-49 e2e admin AC-30/AC-31 หลังแก้ helper | pass | `group-buy-admin-detail.spec.ts` ผ่าน 4/4 บน prod build |
| AC-50 เลือก A แล้วเลือก B → เหลือ B ตัวเดียว และ body เป็น `[{items.product.id, in, [B]}]` | pass | `ac50-03-search-A-then-B.png`, `ac50-02-single-select.png`; e2e AC-50 ผ่านทั้ง 2 เคส (หน้าเดียว และข้ามหน้า) |
| AC-50 ไม่เลือกสินค้าแล้ว submit → `gb-product-required-error` และไม่มี POST | pass | `ac50-01-required-error.png`; e2e AC-32+AC-50 ผ่าน (POST = 0) |
| AC-50 ไม่มีช่องกรอก product ID อิสระ และไม่มีช่องเลือกทั้งหน้า | pass | e2e ตรวจแล้วไม่มี `gb-field-product_ids`, `gb-field-product_id` และ checkbox ใน `thead` |
| AC-50 unit คาด `values` 1 ค่า และไม่มี comment "ว่าง = ทุกสินค้า" | pass | jest ผ่าน 56/56 (`group-buy-form`, `validators`, `single-product`); grep ไม่พบ comment |
| กันกดซ้ำปุ่มสร้าง (กฎข้อ 17) | pass | e2e AC-32: dblclick แล้วมี POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ และได้แคมเปญ 1 แถว |

## Negative / edge case

| เคส | ผล |
|-----|----|
| `operator: "eq"`, 2 rule, product+variant, `values: [A, A]` | ได้ 400 `invalid_data` + code ทุกเคส (`[A, A]` ถูกปฏิเสธ ซึ่งเข้มกว่าถ้อยคำใน spec แต่ตรงกับหลัก "ค่าเดียว") |
| คลิก checkbox ของตัวที่เลือกอยู่ซ้ำ | ยกเลิกการเลือก ("None selected") แล้ว submit ได้ `gb-product-required-error` ไม่มี POST |
| ยิง POST body เดียวกันพร้อมกัน 2 ครั้งผ่าน API | ได้ 200/200 และเกิด 2 แคมเปญ (ดู O-2) |
| submit ฟอร์มที่ว่างทั้งหมด | ขึ้น toast ของช่องแรกที่ผิดก่อน `gb-product-required-error` จะแสดงเมื่อช่องอื่นถูกแล้ว (ตรวจทีละข้อตามแบบเดิมของฟอร์ม) |

## Defect
ไม่มี

## ข้อสังเกต
- O-1: AC-49 เขียนว่าสินค้าเดียวต้องได้ **201** แต่ route ตอบ **200** ซึ่งเป็นพฤติกรรมเดิม และ test ของ builder ก็คาด 200 — รอ owner ตัดสินว่าแก้ spec หรือเปลี่ยน status
- O-2: การสร้างแคมเปญฝั่ง backend ไม่ idempotent UI กันกดซ้ำได้แล้ว แต่ถ้ายิงพร้อมกันผ่าน API จะได้ 2 แคมเปญ (นอกขอบเขต GB-6e)
- O-3: ภาพ `04-product-picker-single` ที่ e2e ของ builder สร้าง ถ่ายตอน animation ของ checkbox ยังไม่จบ ให้ใช้ `ac50-03` แทน
- O-4: test ภาพของ QA รอบรันรวมล้มเพราะข้อมูลทดสอบค้างจากรอบก่อน (ไม่ใช่ defect) ตอนแยกรันผ่าน
