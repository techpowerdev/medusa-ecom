# QA — EV-7c checkout digital-only (PR #174)

Spec: `docs/spec/02-evoucher.md` กฎข้อ 24, AC-3 (ส่วน storefront), AC-37
ทดสอบบน prod build (`medusa start` + `next start`) ด้วย manual payment (`pp_system_default`)
- รอบ 1: commit `929d39e` — CI [run 40553497447](https://github.com/techpowerdev/medusa-ecom/actions/runs/40553497447)
- รอบ 2 (หลังแก้ open redirect): commit `67d16ef` — CI [run 40555573308](https://github.com/techpowerdev/medusa-ecom/actions/runs/40555573308)

Stripe/พร้อมเพย์ตรวจจาก CI; Playwright report และ trace ฉบับเต็มอยู่ใน artifact ของ job `storefront-e2e` (เก็บ 14 วัน); QA spec รันในเครื่อง ไม่ได้ commit

| AC | Result | Evidence |
|----|--------|----------|
| AC-37 voucher ล้วน: ฟอร์มที่อยู่ใบเสร็จ/ใบกำกับภาษี ไม่มีคำว่า "จัดส่ง", หัวข้อเป็นไทย | pass | qa-ac37-billing-form.png |
| AC-37 / AC-3 ไม่มีขั้น delivery, ไป payment ทันที, ค่าจัดส่ง ฿0, order สำเร็จที่ `/th/order/<id>/confirmed` | pass | qa-ac37-review-no-delivery.png |
| AC-37 order: `shipping_methods=[]`, `shipping_address` = ที่อยู่ที่กรอก, `tax_total` 32.71 (500×7/107 ต่างไม่เกิน 0.01) | pass | admin API รอบ 1 และรอบ 2 |
| AC-37 (24d) cart ผสม voucher + t-shirt: ฟอร์มที่อยู่จัดส่งเดิม + ขั้น delivery, order มี shipping method 1 รายการ | pass | qa-ac37-mixed-delivery.png |
| 375px: ฟอร์มและสรุปที่อยู่ไม่ล้นแนวนอน | pass | qa-375-summary.png |
| Regression: `thai-ui-checkout`, `core-19b` (manual), e2e ของ builder 2 ตัว | pass | CI artifact (PromptPay ของ core-19b ดูจาก CI) |

## Negative / edge / security
| กรณี | ผลลัพธ์ | Evidence |
|------|---------|----------|
| ปลอม `digital_only=1` กับ cart ที่มีสินค้าต้องจัดส่ง | ป้องกันได้: UI ยังแสดงขั้น delivery ไม่มีปุ่มยืนยัน; complete cart ผ่าน API ได้ 400 `No shipping method selected but the cart contains items that require shipping.` ไม่เกิด order (รอบ 1 และ 2) | qa-sec-forged-flag.png |
| กดส่งที่อยู่ / ยืนยันคำสั่งซื้อซ้ำ (dblclick) | ได้ order เดียว | ผล test |
| เพิ่ม voucher เกินจำนวน code (2 code, ขอ 3) | 400 `insufficient_inventory` | ผล test |
| แก้ hidden `checkout_country_code` เป็น `/example.org`, `//example.org`, `https://example.org`, `TH`, ค่าว่าง | รอบ 1: **defect** — `/example.org` redirect ไปโดเมนภายนอก; รอบ 2: **pass** — ทุกค่าอยู่ในร้าน (`/checkout?step=payment`) ทำต่อจนได้ `/th/order/<id>/confirmed` | ผล test R2 ×5 |
| ยิง server action `placeOrder` ด้วย countryCode `//example.org` | รอบ 2: **pass** — redirect ไป `/th/order/<id>/confirmed` ในร้าน | ผล test R2 |
| สรุปที่อยู่เมื่อไม่กรอกเขต/อำเภอ | nit: "10500," มี comma ค้าง | qa-375-summary.png |
| country ไม่ถูกต้องหลังแก้ | nit: แถบ URL ค้างเป็น `/checkout?step=payment` ไม่มี `/th` (หน้าใช้งานได้ปกติ) | ผล test |

## Defect
1. Open redirect ผ่าน `checkout_country_code` / `placeOrder(countryCode)` — พบในรอบ 1, แก้แล้วใน `67d16ef` (`safeCountryCode` ตรวจ `^[a-z]{2}$`) และยืนยันแล้วในรอบ 2

ไม่มี defect ค้าง เหลือ nit 2 ข้อ (ไม่ blocker)
