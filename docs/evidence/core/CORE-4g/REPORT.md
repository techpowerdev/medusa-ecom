# REPORT — CORE-4g (PR #170) ขัดเกลา checkout: promotion-error, ที่อยู่ที่บันทึกไว้, ความสูง CountrySelect

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 63, AC-99 (+ regression AC-90/91)
ตรวจโดย qa บน commit `183af94` แบบ prod build (`medusa start` + `next start`) เทียบกับ storefront ของ develop `24d5595` บน backend เดียวกัน
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40528739824 (Playwright report/trace ฉบับเต็มเป็น artifact 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-99 unit: `medusaError` 401/403 → "เข้าสู่ระบบใหม่" ≠ 500; `compareAddresses` null/"" | pass | Vitest `src/core-4g-checkout-polish.test.ts` 10/10 (ชุดเต็ม 402/402) |
| AC-99 e2e: โค้ดของ campaign หมดอายุ → `promotion-error` ไทย, `cart.promotions` ไม่มีโค้ด, ไม่มี `discount-row`, ปุ่มกดได้ | pass | qa-01-promotion-expired.png; e2e `core-4g-checkout-polish.spec.ts` (spec เดียวกันบน develop fail = RED จริง) |
| AC-99 (กันผลบวกปลอม): โค้ดที่ใช้ได้ → ไม่มี `promotion-error`, โค้ดขึ้นใน `discount-row`; โค้ดที่ไม่มีจริง → error ไทย | pass | qa-02-promotion-valid.png; QA spec (ในเครื่อง ไม่ได้ commit) |
| AC-99 e2e: เลือกที่อยู่ที่บันทึกไว้ (company ว่าง) → dropdown แสดง address_1 และ radio `checked` (1280 และ 390) | pass | qa-03-address-select-390.png, 4g-01-address-select-and-country-height.png |
| AC-99 e2e: หลัง `document.fonts.ready` ความสูง CountrySelect ต่างจาก Input ≤ 1px | pass | 48 เทียบ 48 (checkout shipping/billing, ฟอร์มที่อยู่ account) ที่ 1280 และ 390; develop 46 |
| AC-99 grep: `request.delete` ใน `finally` ตรวจ `.ok()` | pass | Playwright unit `core-4g-e2e-hygiene.unit.spec.ts` 2/2 |
| AC-90 (regression) ไม่มี "PromptPay" ในข้อความ UI | pass | Vitest `checkout-thai-polish.test.ts` 8/8 |
| AC-91 (regression) placeholder ไทย, test id/aria-label ของ popup | pass | e2e `core-4e-checkout-polish.spec.ts` |

## NativeSelect หลังย้ายกรอบไปที่ `<select>` (เทียบ develop ที่ 1280 และ 390)
| จุด | develop | PR | ผล |
|---|---|---|---|
| checkout `shipping-country-select` / `billing-country-select` | 46px | 48px (= input) | ดีขึ้นตามกฎ 63d |
| `/account/addresses` `country-select` | 46px | 48px (= input) | ดีขึ้น |
| โปรไฟล์ `billing-country-code-select` | 46px | 46px | ไม่เปลี่ยน |
| คืนสินค้า `return-item-quantity` / `return-item-reason` | 46px | 46px | ไม่เปลี่ยน |

กรอบ 1px, radius 6px, พื้นหลัง และ hover เหมือน develop ทุกจุด ที่ 390px ไม่มีแถวล้น (`scrollWidth` = viewport)

## Negative / edge case
- ดับเบิลคลิก "ใช้โค้ด" ด้วยโค้ดที่ใช้ได้ → cart มีโค้ดเดียว ไม่มี error — pass
- ใส่โค้ดหมดอายุขณะมีโค้ดที่ใช้ได้อยู่ → error ไทย และโค้ดเดิมยังอยู่ — pass
- ใส่โค้ดที่อยู่ใน cart แล้วซ้ำ → ไม่มี error — pass
- โค้ดที่ใช้ได้แต่พิมพ์เล็กหรือมีช่องว่างหัวท้าย → error ไทย ไม่ได้ส่วนลด เพราะ Medusa เทียบตัวพิมพ์และไม่ trim (develop ก็เป็นแบบนี้) — ข้อสังเกต เสนอ task ให้ trim/upper ก่อนส่ง
- `billing-country-code-select` ในโปรไฟล์สูง 46 ขณะที่ input สูง 48 (develop ก็เป็นแบบนี้ อยู่นอกกฎ 63d) — ข้อสังเกต

## Regression
thai-ui-checkout, core-20 return, core-22, core-23, thai-ui-account และ core-19b รอบบัตร ผ่าน 14 test; core-19b รอบ PromptPay ใช้ผลจาก CI (`storefront-e2e` ผ่าน) เพราะในเครื่องใช้ Stripe key ปลอม

## Defect
ไม่พบ
