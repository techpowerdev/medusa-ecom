# QA PAY-6b1: PromptPay หมดอายุแต่ชำระแล้ว (PR #98)
ทดสอบจาก CI: run 40361726659 (job storefront-e2e, commit `0ba7f27`) ผล 38 passed / 0 failed / 0 skipped
เครื่อง QA ไม่มี Stripe publishable key จึงตรวจจาก report, trace และ screenshot ของ CI
report และ trace ฉบับเต็ม: artifact `e2e-evidence` ของ run 40361726659 (เก็บ 14 วัน)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-12: ได้ 409 แล้วแสดง `promptpay-awaiting-order` และไม่เคยแสดง `promptpay-expired` | ผ่าน | `payments-promptpay-already-paid.spec.ts:109` (MutationObserver บันทึก testid ที่แสดงได้แค่ `promptpay-awaiting-order`); `ac12b-complete-failed-awaiting.png` |
| AC-12b: complete cart ทางสำรอง → หน้า confirmed, order เดียว captured อ้าง PI เดิม | ผ่าน | spec:109 (`expectSingleCapturedOrder`); `ac12-ac12b-order-confirmed.png` |
| AC-12b: complete ล้มแล้วยังแสดง awaiting และ poll ต่อจนได้ order | ผ่าน | spec:137 (abort server action ≥2 รอบ แล้วได้ order captured เดียว) |
| ข้อความ fallback ใหม่เป็นภาษาไทยและใช้ data-testid | ผ่าน (ตรวจจากโค้ด) | `renewPromptPaySession` ใน `cart.ts` |
| AC-5 (regression): หมดอายุตามปกติยังได้ QR ใหม่ | ผ่าน | `payments.spec.ts:226`; `ac5-regression-new-qr.png` |
| payments อื่น: AC-1/2/3/4/9, AC-11 race, AC-6 refund | ผ่าน | run เดียวกัน |

## Negative / edge case
- complete cart หรือ poll ล้มจาก network: ครอบใน spec:137 — ผ่าน
- webhook ไม่มา: ลบ `metadata.session_id` ของ PI ทำให้ order มาจาก storefront เท่านั้น — ผ่าน
- กดซ้ำระหว่างสร้าง session ใหม่: โค้ดปิดปุ่มด้วย `setSubmitting(true)` ยังไม่มี e2e
- webhook replay และหน้า order pay (PAY-3): นอกขอบเขต

## ข้อสังเกต (ไม่ block)
1. ข้อความตอน awaiting ("Payment received. Creating your order…") ยังเป็นอังกฤษจาก PAY-2 → แปลใน CORE-4d
2. `renewPromptPaySession` แสดง `body.message` จาก backend ก่อน fallback ไทย — error อื่นของ backend อาจเป็นอังกฤษ
3. ยืนยัน 409 ทางอ้อม (request ยิงจาก server action ไม่เห็นใน browser network)

Defect: ไม่พบ
