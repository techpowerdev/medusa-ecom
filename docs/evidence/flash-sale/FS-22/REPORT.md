# QA — FS-22 (PR #464) spec 03 กฎข้อ 27 / AC-29
ทดสอบเองบน prod build (DB แยกของ qa, env ปลอม ไม่มี Stripe key) — ส่วนบัตรยืนยันจาก CI
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/44897048477 (job storefront-e2e — report/trace ฉบับเต็มอยู่ใน artifact)

| AC | Result | Evidence |
|----|--------|----------|
| AC-29 บัตร + สต็อกชิ้นสุดท้ายหมด (OUT_OF_STOCK) → `checkout-refunded-notice` ไทย มี "คืนเงิน" ไม่มี "ลองใหม่" ไม่มีกล่อง error แดง และ Stripe refund `succeeded` | pass (ยืนยันจาก CI) | CI: fs-22-refunded-notice.spec.ts:111 รันจริงไม่ skip |
| AC-29 บัตร + FLASH_SOLD_OUT → notice | pass (ยืนยันจาก CI) | CI: fs-22-refunded-notice.spec.ts:145 |
| AC-29 บัตร + FLASH_LIMIT_EXCEEDED → notice | pass (ยืนยันจาก CI) | CI: pay-9-refunded-cart-repay.spec.ts:129 step notice |
| AC-29 manual + FLASH_SOLD_OUT → ข้อความเดิม ไม่มี notice (375px) | pass | qa464-01-manual-flash-sold-out-375.png + CI flash-sale-fs15 AC-22 |
| AC-29 manual + FLASH_LIMIT_EXCEEDED → ข้อความเดิม ไม่มี notice (375px) | pass | qa464-02-manual-flash-limit-375.png |
| AC-29 error อื่น / manual + สต็อกหมด → ข้อความเดิม ไม่มี notice | pass | qa464-03-manual-out-of-stock-375.png |
| AC-29 unit Vitest (helper map + render ปุ่มบัตร/manual) | pass | 25/25 ในเครื่อง |

## Negative / edge
- manual + FLASH_SOLD_OUT แล้วกด dblclick ซ้ำ และกดอีกครั้ง → ข้อความเดิม ไม่มี notice ยังอยู่ /checkout: pass
- ในเครื่องไม่มี Stripe key: spec ที่ใช้บัตร skip ตามที่ออกแบบ — complete เป็น server action และ backend ต้องเรียก Stripe จริง จึงยืนยันจาก CI
- AC-29 เขียนว่า "e2e route mock" แต่ใช้ race จริง + Stripe test mode แทน เพราะ route mock ดัก server action ไม่ได้ (พิสูจน์ได้แรงกว่า)

## ข้อสังเกต
- กรณี FLASH_* hook ล้มก่อน Medusa สร้าง Payment: เงินคืนผ่าน webhook (processPaymentWorkflow → compensatePaymentIfNeededStep) CI ตรวจ refund จริงเฉพาะเคสสต็อกหมด เคส FLASH ตรวจข้อความ
- manual + สต็อกหมด ยังได้ข้อความ fallback "ลองใหม่" แบบทั่วไป (follow-up รอบ 41)
