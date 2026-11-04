# QA CORE-32 — กรองวิธีส่ง Digital delivery (PR #243)
Spec: `docs/spec/01-core-medusa.md` กฎข้อ 89, AC-125 · ทดสอบบน prod build (backend `medusa start` + storefront `next start`) · commit 336c3d5

| AC | Result | Evidence |
|----|--------|----------|
| AC-125 unit (`lib/util/shipping-options.test.ts`) | pass | vitest 6/6 passed |
| AC-125 e2e checkout: cart t-shirt มี Standard ไม่มี Digital delivery | pass | `core-32-shipping-profile-filter.spec.ts` (passed) + qa-01-checkout-mixed-cart-no-digital.png (cart ผสม) |
| AC-125 e2e หน้ากลุ่ม: `group-shipping-option` ไม่มี option ของ Digital delivery | pass | `core-32-shipping-profile-filter.spec.ts` (passed) + qa-02-group-375-no-digital.png |
| กฎ 89c / spec 02 AC-37: cart ดิจิทัลล้วนข้ามขั้น delivery, cart ผสมมีขั้น delivery | pass | `ev-7c-digital-only-checkout.spec.ts` 2/2 passed |
| กฎ 89d: กรองแล้วไม่เหลือ option | pass (ดูข้อสังเกต O-1) | qa-03-checkout-no-option-left.png, qa-04-group-no-option-left.png |
| spec 04 AC-28 (join group) | pass | `group-buy-join.spec.ts` 7/7 passed |

**Negative/edge** (QA spec ชั่วคราว ผ่าน 4/4)
- cart ผสม (สินค้าดิจิทัลที่ไม่มี shipping profile + t-shirt): API ยังคืนทั้งสอง option แต่ UI แสดงแค่ Standard เลือกแล้วไปขั้นชำระเงินได้ ลองกด `submit-delivery-option-button` สองครั้งติดกันแล้ว cart ยังมี shipping method เดียวคือ Standard
- จอ 375px: checkout และหน้ากลุ่มไม่มี Digital delivery และไม่ล้นแนวนอน ข้อความของ `delivery-heading`/`delivery-method-title`/ปุ่ม/`group-join-button`/`group-join-error` ตรง regex `[฀-๿]`
- ปิด Standard ชั่วคราวผ่าน rule `enabled_in_store` (เปิดคืนใน `finally`) ทำให้ API คืนแค่ Digital delivery
  - checkout: ไม่มี `delivery-option-radio` และปุ่มไปต่อ disabled
  - หน้ากลุ่ม: `group-join-error` ขึ้น "ไม่มีวิธีจัดส่งสำหรับที่อยู่นี้ กรุณาเลือกที่อยู่อื่น" และไม่มี select
- cart t-shirt ที่ตั้ง shipping method เป็น Digital delivery ไว้ก่อนผ่าน API: ผลอยู่ที่ O-2

**Defect:** ไม่มี

**ข้อสังเกต (ไม่บล็อก)**
- O-1: checkout ไม่มีข้อความ "ไม่มีวิธีส่ง" มาตั้งแต่เดิม (เป็นของ starter) เมื่อกรองแล้วว่าง `delivery-options-container` จึงว่างเปล่า มีแค่ปุ่มที่ disabled ส่วนหน้ากลุ่มมีข้อความครบ ถือว่าตรงกฎ 89d ("ข้อความเดิมของแต่ละหน้า") แต่ผู้ใช้ไม่ได้รับคำอธิบาย ควรเปิด follow-up เพิ่มข้อความไทยพร้อม testid
- O-2: ถ้า cart ที่มีสินค้าต้องจัดส่งมี shipping method = Digital delivery ค้างอยู่ (เช่น cart ที่สร้างก่อน PR นี้) ที่ checkout จะไม่มี radio ไหนถูกเลือก แต่ปุ่มไปต่อ enabled และไปถึง step=payment ได้ โดยหน้าสรุปยังแสดง "Digital delivery" ฝั่ง backend ปฏิเสธตอน complete (`400 invalid_data` "The cart items require shipping profiles that are not satisfied by the current shipping methods") จึงไม่เกิด order ที่ผิด แต่ผู้ใช้จะเจอ error ตอนท้าย ควรพิจารณาให้ checkout ถือ method ที่ไม่อยู่ในรายการที่กรองแล้วเป็นยังไม่ได้เลือก
- O-3: ยิง join API ตรงด้วย Digital delivery ยังทำได้ — ปิดโดย GB-14 (spec 04 กฎข้อ 35, Q-C4 = ข)

**สรุป:** AC-125 และกฎ 89 (a–d ตามทาง (b)) ผ่าน regression ของ EV-7c และ GB join ผ่าน ไม่พบ defect พร้อม merge ส่วน O-1/O-2 แนะนำให้เป็น follow-up
Report/trace ฉบับเต็มอยู่ที่ CI artifact `e2e-evidence` (14 วัน)
