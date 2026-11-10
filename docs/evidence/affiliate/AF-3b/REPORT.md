# QA — AF-3b sync cookie `aff` ก่อน complete (PR #119)

Spec: `docs/spec/05-affiliate.md` กฎ 23, AC-21, AC-22 · commit `71a9046`
สภาพแวดล้อม: backend `medusa start` (build) :9138, storefront `next start` (prod build) :8138, DB แยก, `AFFILIATE_TOKEN_SECRET=test`, Stripe ใช้ค่าปลอม

| AC | Result | Evidence |
|----|--------|----------|
| AC-21 cookie เปลี่ยน Ann → Bob แล้ว checkout ทันที (manual) | pass | af3b-order-confirmed.png (e2e `affiliate-last-click.spec.ts` 3/3), ac21-bob-order-confirmed.png — `order.metadata.affiliate_token` = token ของ Bob = `cart.metadata` ตอน complete, entry 1 รายการเป็นของ Bob, `POST /store/carts/:id` 1 ครั้งก่อน complete |
| AC-21 cookie ไม่เปลี่ยน → ไม่มี POST sync | pass | ac21-unchanged-ann.png + unit `cart-affiliate-sync.test.ts` — นับจาก log HTTP ของ backend ได้ 0 ครั้ง, order/entry เป็นของ Ann |
| AC-21 Stripe card / PromptPay | ไม่ได้ตรวจใน QA | ไม่มี Stripe test key ในเครื่อง; CI storefront-e2e run 40439943429 ผ่าน แต่ไม่มี e2e ที่ตรวจ attribution ของ order บัตร/PromptPay หลังเปลี่ยน cookie — หลัง review รอบ 1 builder เพิ่ม component unit ยืนยันการเรียก sync ก่อน confirm (ดู `docs/evidence/affiliate/AF-3b-tests.txt`) |
| AC-22 add to cart อ่าน cart เท่าก่อน AF-2 และตั้ง metadata เมื่อค่าต่าง | pass | Vitest `cart-affiliate-sync.test.ts` 8/8, `cart-add-route.test.ts` 3/3 (ทั้งชุด 230/230) |

## Negative / edge
| กรณี | ผล | Evidence |
|------|----|----------|
| กดสั่งซื้อซ้ำ (dblclick) หลังเปลี่ยนเป็น Bob | pass — order 1 รายการ, `/complete` 1 ครั้ง, entry ของ Bob 1 รายการ | edge-dblclick.png |
| cookie `aff` ถูกปลอมหลัง add | สั่งซื้อสำเร็จ ไม่มี entry ของใคร (backend ตรวจลายเซ็น); token เดิมของ Ann ถูกเขียนทับ — ไม่ใช่ defect | edge-tampered.png |
| cookie `aff` หายหลัง add | pass — ไม่ sync, order/entry ยังเป็นของ Ann | ผล test |
| webhook replay | ไม่ได้ตรวจ (ไม่มี Stripe key, PR ไม่แก้ backend) | — |

ข้อสังเกต: server storefront ตัวแรกหลัง build แสดงหน้า review ด้วย cart เก่าจนต้อง reload (core-store AC-1 ก็ล้มแบบเดียวกัน) หลัง restart ผ่านทุกรอบ ทำซ้ำไม่ได้ CI ผ่าน
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ https://github.com/techpowerdev/medusa-ecom/actions/runs/40439943429 (14 วัน)
