# QA CORE-34 (PR #252): ล้าง `promotion-error` ตอนลบโค้ดส่วนลด

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 92, AC-128 · prod build · commit `23b34ad` · viewport 1280px และ 375px · หน้า `/th/cart` และ `/th/checkout?step=payment`

| AC | Result | Evidence |
|----|--------|----------|
| AC-128 cart 1280px: ใส่โค้ดผิดแล้ว error ขึ้น, ใส่โค้ดถูกแล้วมีแถวโค้ด, ใส่โค้ดผิดอีกครั้งให้ error ค้าง, กดลบ (หน่วง server action ด้วย `page.route`) ระหว่างรอไม่มี `promotion-error` และแถวโค้ดยังอยู่, ลบสำเร็จแล้วไม่มี error และ backend ไม่มีโค้ด | pass | qa-01-cart-1280-pending-no-error.png |
| AC-128 cart 375px: flow เดียวกัน + ลบ `_medusa_jwt` แล้วกดลบ: ระหว่างรอไม่มี error เก่า, แล้วขึ้น `SIGN_IN_AGAIN_MESSAGE` ที่ตรง regex `[฀-๿]`, แถวโค้ดยังอยู่, backend ไม่เปลี่ยน | pass | qa-02-cart-375-sign-in-again.png |
| AC-128 checkout 1280px (flow เดียวกัน) | pass | qa-03-checkout-1280-removed-no-error.png |
| AC-128 checkout 375px (flow เดียวกัน) | pass | qa-04-checkout-375-pending-no-error.png |
| Negative control: build ที่ไม่มีบรรทัดแก้ของ PR | e2e ล้มทั้ง 4 ชุดที่ขั้น "ระหว่างรอ" (`expect(promotion-error).toHaveCount(0)`) ตามที่คาด แสดงว่า test จับ bug ได้จริง | qa-05-control-prefix-stale-error.png |
| AC-121 / AC-128 unit (`core-28-promotion-error.test.ts` + `core-34-remove-promotion-error.test.ts`) | pass (5/5) | ผล vitest |
| Regression e2e: `core-14g-action-stale-jwt`, `core-19c-delete-button-error` (5 test), `core-4g-checkout-polish` | pass (7/7) | ผล playwright |

e2e ของ QA (ชั่วคราว ไม่ได้ commit): 4 test = 2 หน้า × 2 viewport ผ่าน 4/4 · element หาด้วย `data-testid` ทั้งหมด

## Negative / edge (`/th/cart` 1280px, มี error เก่าค้างก่อนทำ)
| กรณี | ผล |
|------|----|
| ดับเบิลคลิก `remove-discount-button` | pass: มี server action ออกไป 1 ครั้ง, แถวโค้ดหาย, ไม่มี error, backend ไม่มีโค้ด |
| server action ของการลบตอบ 500 | pass: `promotion-error` แสดงข้อความไทย "ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง", แถวโค้ดยังอยู่, backend ไม่เปลี่ยน |
| JWT หาย, กดลบแล้วได้ SIGN_IN_AGAIN จากนั้นใส่ JWT คืนแล้วกดลบอีกครั้ง | pass: ลบสำเร็จและ error เดิมหาย |
| โค้ดใน campaign ที่หมดอายุ | ครอบคลุมแล้วโดย regression `core-4g` AC-99 (pass) |

## Defect
ไม่มี

## Observation (ไม่ใช่ defect ของ PR นี้)
- O-1: ระหว่างรอการลบ ปุ่ม `remove-discount-button` ไม่มี spinner และไม่ disabled ผู้ใช้จึงไม่เห็นว่ากำลังลบอยู่ (ดู qa-01/qa-04) อย่างไรก็ตามดับเบิลคลิกแล้วยังส่ง action แค่ครั้งเดียวและผลลัพธ์ถูกต้อง
- O-2: เมื่อการลบล้มด้วยสาเหตุอื่นที่ไม่ใช่ auth ระบบใช้ข้อความ fallback ของการ "ใช้" โค้ด (`PROMOTION_FAILED`) ซึ่งอาจทำให้ผู้ใช้สับสนในบริบทของการลบ พฤติกรรมนี้มีอยู่แล้วตั้งแต่กฎข้อ 85 ถ้าจะเปลี่ยนต้องตัดสินใน spec
- O-3: test หลักของ QA ใช้เวลาประมาณ 32 วินาทีต่อชุด เพราะแต่ละชุดมีหลายรอบของ action และการรอ `networkidle` ไม่กระทบผลการทดสอบ

## สรุป
AC-128 / กฎข้อ 92 pass ครบทั้ง cart และ checkout ที่ 1280px และ 375px บน prod build, negative control ยืนยันว่า test จับ bug ได้จริง และ regression ผ่านทั้งหมด จาก QA ไม่มีอะไรขวางการ merge
