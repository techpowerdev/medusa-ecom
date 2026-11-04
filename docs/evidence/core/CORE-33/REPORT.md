# QA CORE-33 (PR #255): ไม่มีวิธีส่งหลังกรอง / method ค้างที่ถูกกรองออก
Spec: `docs/spec/01-core-medusa.md` กฎข้อ 91 และ AC-127 ทดสอบบน prod build (`medusa start` + `next start`) ที่ commit `935b548` viewport 1280 และ 375 หา element ด้วย `data-testid` และตรวจความเป็นไทยด้วย regex `[฀-๿]`

| AC | Result | Evidence |
|----|--------|----------|
| AC-127 (91b): cart t-shirt ที่ค้าง Digital delivery ไม่มี radio ที่ `aria-checked="true"`/`data-checked`/`data-state=checked` ใน `delivery-options-container` ไม่มี option ของ Digital และปุ่ม `submit-delivery-option-button` disabled ทั้ง 1280 และ 375 | pass | qa-01-stale-digital-not-selected-1280.png, qa-02-stale-digital-not-selected-375.png |
| AC-127 (91b): เลือก Standard แล้วปุ่ม enabled และ `GET /store/carts/:id` มี `shipping_methods` = [Standard] ตัวเดียว (ไม่มี Digital ค้าง) ไปขั้นชำระเงินและขั้น review ได้ | pass | qa-03-standard-then-review-1280.png |
| AC-127 (91b): ขั้น delivery ปิด (`?step=payment`) บน cart ค้าง Digital ส่วนสรุปไม่มี `name` ของ method จาก fixture ของ API ("Digital delivery", amount 0) ไม่มีราคา `฿` ไม่มีไอคอนถูก หัวข้อจาง และกด `edit-delivery-button` กลับมาแล้วยังไม่มี radio ที่ติ๊ก | pass | qa-04-closed-summary-stale-375.png |
| AC-127 (91a): ปิด Standard ด้วย rule `enabled_in_store` (เปิดคืนใน `finally`) แล้ว Store API ยังคืน Digital แต่หน้าเว็บแสดง `delivery-options-empty` เป็นภาษาไทย ไม่มี `delivery-options-container` ไม่มี radio ในส่วน delivery ปุ่ม disabled และไม่มี horizontal scroll ที่ 375 | pass | qa-05-delivery-options-empty-375.png |
| AC-127 unit/component: Vitest `shipping-options.test.ts` และ `core-33-delivery-empty.test.ts` | pass (16/16) | ผล vitest |
| AC-127 grep: comment ภาษาไทยในบล็อก `cartReadyForPayment` ของ `core-32-shipping-profile-filter.spec.ts` (กฎ 91d) | pass | diff ของ PR บรรทัดประมาณ 72–75 |
| AC-125 และ spec 02 AC-37 (regression): `core-32-shipping-profile-filter` 3 test, `ev-7c-digital-only-checkout` 2 test, `thai-ui-checkout` 1 test | pass (6/6) | ผล playwright |
| Regression `MedusaRadio` `aria-checked`: ในขั้น payment หลังเลือก `pp_system_default` มี radio ที่ `aria-checked="true"` แค่ 1 ตัว ตัวอื่นเป็น `"false"` และ `data-state=checked` ตรงกับตัวที่เลือก | pass | test ของ qa (ไม่มีรูปแยก) |

## Negative / edge
- ค้าง Digital และไม่เหลือ option เลย: ขึ้น empty state ภาษาไทยเหมือนกัน และปุ่ม disabled — pass
- cart ที่เลือก Standard ไว้แล้ว: radio ของ Standard ติ๊ก (ทั้ง option และ `role=radio` ด้านใน) และปุ่ม enabled ไม่ถดถอย — pass
- double-click radio Standard แล้ว double-click ปุ่มไปต่อ: cart มี method เป็น Standard ตัวเดียว ไม่มี error และไปขั้น payment ได้ — pass
- ข้ามขั้น delivery ด้วย URL บน cart ค้าง Digital แล้วยิง `POST /store/carts/:id/complete`: backend ตอบ 400 `invalid_data` "The cart items require shipping profiles that are not satisfied by the current shipping methods" จึงไม่มี order เกิดขึ้น (Medusa กันไว้ตามที่ spec ระบุ)

## Defect
ไม่พบ

## Observation (ไม่บล็อก)
- **O-1:** cart ค้าง Digital แล้วเปิด `?step=payment` ขั้นชำระเงินยังเปิดให้เลือกวิธีชำระได้ ถ้าลูกค้าไปจนกดสั่งซื้อจะเจอ 400 ภาษาอังกฤษจาก `validate-shipping` ซึ่ง spec ระบุไว้เป็น out of scope แล้ว (reviewer ชี้ต้นเหตุ: `deliveryStepDone` ใน `lib/util/digital-checkout.ts` นับแค่ `shipping_methods.length > 0`)
- **O-2:** ที่ 375px ส่วนสรุปที่อยู่ ข้อความ "ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง" ซ้อนกับอีเมลยาวในคอลัมน์ข้างกัน (qa-02, qa-04, qa-05) เป็นปัญหาที่มีอยู่ก่อนแล้ว ไม่ได้มาจาก PR นี้
- **O-3:** ขณะ cart ค้าง Digital ช่อง "ค่าจัดส่ง" ในสรุปตะกร้าแสดง ฿0 ตามราคาของ method ที่ค้างใน cart ส่วนสรุปของขั้น delivery ไม่แสดงตามกฎ 91b

## สรุป
AC-127 และกฎข้อ 91 (a, b, d) ผ่านครบทั้ง 1280 และ 375 regression ผ่านทั้ง AC-125, spec 02 AC-37, thai-ui-checkout และ radio ของขั้น payment ไม่พบ defect
