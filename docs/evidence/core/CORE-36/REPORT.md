# QA CORE-36: ปุ่มลบโค้ดส่วนลดแสดงสถานะกำลังลบ กันคลิกซ้อน และแจ้งข้อความเฉพาะการลบ (PR #264)
Spec: `docs/spec/01-core-medusa.md` กฎข้อ 94, AC-130 · ทดสอบบน prod build (backend `medusa build`/`medusa start` + storefront `next build`/`next start`) ที่ commit `e80f04c` · Stripe test mode · viewport 1280 และ 375 · หน้า `/th/cart` และ `/th/checkout` · หา element ด้วย `data-testid` · ตรวจความเป็นไทยด้วย regex `[฀-๿]` · ข้อความที่คาดหวังอ่านจาก constant ที่ export ใน component (`PROMOTION_FAILED`, `PROMOTION_REMOVE_FAILED`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-130 ปุ่มขึ้น `disabled` + `aria-busy="true"` ระหว่างลบ (ใช้ `page.route` ค้าง server action ไว้) และปุ่มของโค้ดอีกตัวก็ disabled ด้วย | pass (cart/checkout × 1280/375) | qa-01-busy-cart-1280.png, qa-02-busy-checkout-375.png |
| AC-130 เรียก `el.click()` 2 ครั้งใน tick เดียว + dblclick + คลิกรัว 3 ครั้งที่ปุ่มของอีกแถว → server action ถูกยิง 1 ครั้ง | pass (4/4) | ผล test (นับ POST ที่มี header `next-action`) |
| AC-130 ลบสำเร็จ → เหลือ 1 แถว ปุ่มที่เหลือกลับมากดได้ ไม่มี error ใน backend เหลือแต่โค้ดอีกตัว และกดลบตัวนั้นต่อได้ | pass (4/4) | ผล test + `GET /store/carts` |
| AC-130 server action ตอบ 500 → `promotion-error` = "ลบโค้ดส่วนลดไม่สำเร็จ กรุณาลองอีกครั้ง" (มีอักษรไทย และ ≠ `PROMOTION_FAILED`) แถวโค้ดยังอยู่ ปุ่มกลับมากดได้ โค้ดใน backend ยังอยู่ | pass (4/4) | qa-03-remove-500-checkout-1280.png, qa-04-remove-500-cart-375.png |
| AC-130 ลบ `_medusa_jwt` แล้วกดลบ → `SIGN_IN_AGAIN_MESSAGE` แถวโค้ดยังอยู่ | pass (4/4) | qa-05-signin-again-cart-1280.png |
| AC-130 ใส่โค้ดแล้ว action ตอบ 500 → ยังได้ข้อความเดิม `PROMOTION_FAILED` | pass (4/4) | ผล test |
| AC-121 (CORE-28), AC-128 (CORE-34) unit | pass 10/10 | vitest `core-28-promotion-error`, `core-34-remove-promotion-error` |
| regression e2e core-14g (AC-120), core-19c (AC-100/104) | pass 6/6 | Playwright |
| regression e2e core-4g (AC-99) | flaky 1/3 (ดู O-2) | Playwright |

## Negative/edge
- ลบล้มด้วย 500 แล้วลองอีกครั้งหลัง backend กลับมาปกติ → error หาย แถวโค้ดหาย: pass
- มี 2 โค้ดแล้วลบตัวหนึ่ง (สร้างโค้ด standard 5% 2 ตัวผ่าน admin API ใส่ซ้อนกันได้) → ลบได้ทีละตัวถูกต้อง: pass
- กดใส่โค้ด B ระหว่างที่การลบโค้ด A ยังค้างอยู่ → โค้ด A กลับมา (ดู O-1)

## Defect
ไม่มี (ทุกข้อของ AC-130 ผ่าน)

## Observation
- **O-1 (นอก scope ของกฎข้อ 94, มีมาก่อน PR นี้)** ระหว่างที่การลบยังไม่เสร็จ ปุ่ม `discount-apply-button` ยังกดได้ ถ้าใส่โค้ด B ระหว่างนั้น Next จะรอให้ action ลบเสร็จก่อนแล้วค่อยส่ง action ใส่โค้ด แต่รายการโค้ดที่ส่งไปคำนวณจาก `promotions` ของตอนที่คลิก (ยังมี A อยู่) ผลคือ backend ได้ `[A, B]` และโค้ด A ที่ผู้ใช้เพิ่งลบกลับมาโดยไม่มีข้อความแจ้ง ทำซ้ำได้ 2/2 รอบ — ขั้นตอน: cart มีโค้ด A → ค้าง action ลบ A → ใส่ B กดใช้โค้ด → ปล่อย action ลบ; expected: ได้แค่ B / actual: ได้ A และ B — เสนอ follow-up: disable ฟอร์มใส่โค้ดระหว่างลบ หรือไม่ส่งโค้ดที่กำลังลบไปด้วย (reviewer ชี้ประเด็นเดียวกันเป็น nit)
- **O-2** e2e `core-4g-checkout-polish` AC-99 ผ่าน 1 ใน 3 รอบ ทุกรอบที่ล้ม ล้มที่ `add-product-button` ยังไม่กลับมากดได้ภายใน 5 วินาทีบนหน้าสินค้า (`core-4g-checkout-polish.spec.ts:113`) ก่อนถึงส่วนโค้ดส่วนลด PR นี้ไม่ได้แก้ไฟล์ดังกล่าว เป็น flaky เรื่อง timeout ที่มีอยู่เดิม
- **O-3** สถานะกำลังลบมองเห็นได้น้อย มีแค่ไอคอนถังขยะจางลง (opacity-50) ไม่มี spinner ซึ่งยังตรง spec (กำหนด "spinner หรือ `aria-busy`")
- **O-4 (มีมาก่อน)** ที่จอ 375 ตารางสินค้าในหน้า cart ล้นขอบขวา คอลัมน์ "รวม" ถูกตัด (เห็นในรูป qa-04)

## สรุป
PR #264 ผ่าน AC-130 และกฎข้อ 94 ทุกข้อบน prod build ทั้งหน้า cart และ checkout ที่ 1280/375 ไม่พบ defect regression ผ่านหมด ยกเว้น core-4g ที่ flaky ด้วยเหตุที่ไม่เกี่ยวกับ PR นี้ (O-2)
