# QA — CORE-20d (PR #168) ช่วงคืนสินค้า: ค่าเริ่มต้น, ช่วงคืนต่อ line, error ไทย, ฟอร์มคงค่า

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 66, AC-102 (+ regression AC-96, AC-65) — ตรวจ head `8774cda` บน prod build (`medusa start` + `next start`)
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40523555434 (Playwright report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` เก็บ 14 วัน)
ผล: e2e ของ builder 6/6, QA spec (ในเครื่อง ไม่ได้ commit) 6/6

| AC | Result | Evidence |
|----|--------|----------|
| AC-102 (a) region ไม่มี `return_window_days` → ปุ่มขอคืนแสดง, `/th/returns` = 30 วัน, JSON-LD หน้าแรก TH = 30 | pass | qa-01-returns-30-days-no-shipping-meta.png; e2e `AC-102 (a)` (รวมรอบ ISR) |
| AC-102 (b) line A พ้นช่วง, line B ส่งเมื่อวาน → ปุ่มยังแสดง, ฟอร์มมีเฉพาะ B, ส่ง B → 200, ส่ง A → 400 `RETURN_WINDOW_EXPIRED` | pass | qa-04-return-form-line-b-only.png; e2e `AC-102 (b)` |
| AC-102 (c,e) ส่งล้ม → `return-error` ภาษาไทย, จำนวน/เหตุผลยังเป็นค่าที่เลือก, กดส่งซ้ำได้ | pass | qa-02-real-failure-keeps-values.png (ล้มจริง 2 ครั้งค่ายังอยู่ จากนั้นส่งสำเร็จ ได้ return 1 รายการ); e2e `AC-102 (c, e)` (route mock) |
| AC-102 PDP JSON-LD มี `hasMerchantReturnPolicy` (30 วัน) แม้ region ไม่มี `shipping_rate` | pass | QA-4 (merchantReturnDays 30, applicableCountry TH) |
| AC-102 contract test / PDP ใช้ `retrieveRegionUncached(region.id)` | pass | CI `lint-typecheck` (storefront vitest) |
| Security: `GET /store/orders/:id` ของลูกค้าอื่น / ไม่ login | pass | ลูกค้าอื่น 404, ไม่ login 401; ลอง field อื่นใต้ `fulfillments.items` 10 แบบ ไม่มีอะไรหลุดนอกจาก `line_item_id` |
| 375px ฟอร์มขอคืนไม่ล้นจอ | pass | qa-03-return-form-375px.png |
| AC-96 (regression CORE-20c) | pass | e2e `core-20c-return-window.spec.ts` 2/2 |
| AC-65 (regression CORE-20) | pass | e2e `core-20-return-request.spec.ts` 1/1 |

## Negative / edge
| กรณี | ผล |
|------|----|
| dblclick ส่ง | return 1 รายการ ไม่ซ้ำ |
| ส่งล้มติดกัน 2 ครั้งด้วยค่าเดิม | ค่าที่เลือกยังอยู่ทั้งสองรอบ ปุ่มกดได้ |
| ทุก line พ้นช่วงคืน | ไม่มี `order-return-button`; เปิด URL `/return` ตรงๆ ก็ไม่มีฟอร์มส่ง |
| รอบ ISR (กฎข้อ 66f) | `/returns` และ PDP อัปเดตภายใน ≤ 90 วินาที |
| เก็บ evidence ของ e2e (กฎข้อ 67) | เขียนเฉพาะใต้ `docs/evidence/core/CORE-20d/` |

## หมายเหตุ
- field ระดับ fulfillment (`data`, `provider`, `delivery_address`, `created_by` ฯลฯ) ถูกส่งกลับให้เจ้าของ order อยู่แล้วตั้งแต่ก่อน PR นี้ (core ของ Medusa อนุญาต `fulfillments`) PR นี้เปิดเพิ่มแค่ `fulfillments.items.line_item_id`

Defect: ไม่พบ
