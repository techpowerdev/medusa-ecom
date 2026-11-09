# QA EV-7d — PR #320 (digital-only cart-totals + `safeCountryCode`)

- Spec: `docs/spec/02-evoucher.md` แถว EV-7d, กฎข้อ 28, AC-42; regression AC-37
- รอบแรก: `e0fcffcc` · รอบสอง (re-test หลังแก้ตาม review): `ee463d0e`
- prod build ทั้งสองฝั่ง · manual provider · ส่วน Stripe พิสูจน์ด้วย CI (รอบแรก run 42565844923, รอบสอง run 42569130912)

| AC / รายการ | รอบแรก `e0fcffcc` | รอบสอง `ee463d0e` | Evidence |
|---|---|---|---|
| AC-42 digital-only ที่ไม่เคยเลือก shipping: `/th/cart` + review (1280, 375) ไม่มีแถว "ค่าจัดส่ง"/"ไม่รวมค่าจัดส่ง" | pass | pass | ac42-cart-375.png, ac42-review-1280.png |
| AC-42 cart ผสมมีแถวค่าจัดส่ง ยอดตรง API | pass | pass | ac42-mixed-cart-1280.png |
| ใหม่: voucher ฿500 + t-shirt เลือก Standard แล้วลบ t-shirt: `/th/cart`, review, confirmed มีแถวค่าจัดส่ง ยอดแถวรวมเท่า total (467.29 + 9.35 + 33.36 = 510) | - | pass | kept-shipping-confirmed-1280.png |
| ใหม่: voucher + t-shirt ไม่เลือก shipping แล้วลบ t-shirt: ไม่มีแถวค่าจัดส่ง | - | pass | spec QA |
| AC-42 unit `isDigitalOnlyCart` + static `safeCountryCode` | pass (vitest 85/85) | pass (`ev-7d-digital-only-totals.test.ts` 29/29) | ผล vitest |
| AC-37 regression ev-7c; tax digital-only ต่างจาก total×7/107 ≤ 0.01 | pass (2/2) | pass (2/2 ในเครื่องและ CI) | spec QA, CI |
| t-shirt ล้วน: แถวค่าจัดส่ง ยอดถูก, confirmed แสดงค่าส่ง > 0 | pass | pass | spec QA |
| redirect `step=payment` (digital-only) / `step=delivery` (ผสม, t-shirt) | pass | pass | header `x-action-redirect` |
| digital-only เปิด `step=delivery` → `step=payment` | pass | ไม่ได้รันซ้ำ | spec QA รอบแรก |
| ปลายทางตาม country ใน URL (`/la` และ `/th`) | pass | ไม่ได้รันซ้ำ | spec QA รอบแรก |
| country ปลอม: `/zz/*`, โดเมนใน path, `payment-return`, ฟอร์มปลอม 6 ค่า | pass | ไม่ได้รันซ้ำ | log รอบแรก |
| ฟอร์มปลอม `digital_only=1` บน cart ผสม | pass | ไม่ได้รันซ้ำ | spec QA รอบแรก |
| ฟอร์มค้าง voucher→ผสม และ ผสม→voucher: ข้อความไทย ไม่บันทึกทับ | pass | pass | stale-form-thai-1280.png |
| ฟอร์มค้าง → ตะกร้าว่าง | pass | ฟอร์ม voucher pass; ฟอร์มที่ต้องจัดส่ง ไม่มีข้อความ (ข้อสังเกต 1) | spec QA |
| ที่อยู่ว่าง (voucher, t-shirt): `required` กันไม่ให้ส่ง; เมื่อข้าม `required` ไม่ขึ้น "ตะกร้ามีการเปลี่ยนแปลง" | - | pass | spec QA |
| กดยืนยันสั่งซื้อสองครั้ง → 1 order | pass | ไม่ได้รันซ้ำ | spec QA รอบแรก |
| บัตร AC-1/2/3 และ PromptPay AC-4/5 | pass | CI 262 passed | CI run 42569130912 |
| `payments-promptpay-already-paid` :38, :69 และ `payments-promptpay-fallback-cap` :47, :90 | fail 3 test (D-1) | pass 4/4 | CI run 42569130912 |

## Defect
- D-1 (blocker): matcher `body === JSON.stringify([cartId])` ไม่ตรงกับ argument ใหม่ของ `placeOrder` ทำให้ test ทางสำรอง PromptPay ล้ม 3 test ที่ `e0fcffcc` — **ปิดแล้ว** ที่ `ee463d0e` (ใช้ `isCartIdActionBody`, CI ผ่าน)

## ข้อสังเกต (นอก AC)
1. ฟอร์มที่ต้องจัดส่งกรอกครบ แล้วตะกร้าถูกลบจนว่างจากอีกแท็บ: ไม่มีข้อความ, บันทึกที่อยู่บน cart 0 รายการ, ไป `step=delivery` และเดินต่อถึง review ได้; กดยืนยันแล้วไม่เกิด order. ไม่ได้เกิดจาก fix รอบนี้ (ฟอร์มกรอกครบ `.get` กับ `.has` ให้ผลเท่ากัน) ผล pass รอบแรกน่าจะมาจาก select ประเทศถูกรีเซ็ตจน browser กันไว้ ซึ่ง CORE-4j แก้แล้ว
2. server ไม่กันที่อยู่ว่างแล้ว (`.has`): ผู้ใช้ปกติถูก `required` กัน, ถ้าข้าม `required` จะบันทึก `address_1=""` แล้วเด้งกลับ `step=address` โดยไม่มีข้อความ; ที่อยู่เป็นช่องว่างล้วนผ่านถึง `step=payment` (พฤติกรรมเดิม)
3. ฟอร์มผสมที่ติ๊ก same-as-billing ออก แล้วอีกแท็บลบ t-shirt: ใช้ billing เป็นทั้งสองที่อยู่และไป `step=payment` ไม่มีข้อความ ไม่บันทึกค่าว่างทับ
4. confirmed ของ voucher ยังแสดง "การจัดส่ง" และ "วิธีจัดส่ง (฿0)" จาก `shipping-details` (PR ไม่ได้แตะ) — จากรอบแรก ไม่ได้ตรวจซ้ำ
5. country ของปลายทางบัตร/พร้อมเพย์บน URL `/la` พิสูจน์ด้วย static grep ไม่ใช่ e2e — จากรอบแรก
