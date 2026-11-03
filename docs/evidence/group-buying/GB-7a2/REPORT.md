# QA REPORT — GB-7a2 (PR #238) join บนหน้ากลุ่ม `/<cc>/g/<token>`

Spec: `docs/spec/04-group-buying.md` (กฎข้อ 14c, 27, 29c–f, 31; AC-28 ส่วน e2e, AC-47)
สภาพแวดล้อม: backend prod build (`.medusa/server`) + storefront `next build && next start`, DB seed ใหม่แยกของ qa, Redis db แยก, node 22.23.3, ไม่ใช้ Stripe (ไม่มีขั้นชำระเงิน)
รอบ 1 ตรวจที่ `5a036bb` พบ D1 และ D2 · รอบ 2 ตรวจที่ `d7aac98` ยืนยันว่าแก้แล้ว และรัน regression ทั้งชุด (e2e 18/18: `group-buy-join.spec.ts` 7, `group-buy-group-page.spec.ts` 3, QA 8; unit vitest 44/44)

| AC / กฎ | รอบ 1 | รอบ 2 | Evidence |
|---|---|---|---|
| AC-28 A: V1×2 + V2×1, ที่อยู่ H2, วิธีส่ง S, `dblclick` join → cart ใหม่ 1 ใบที่ใช้ join, membership 1 รายการ `units = 3`, draft order มี item/ที่อยู่ H2/วิธีส่ง S/`shipping_total` = ราคา S/`total = item + shipping` และ `customer_id = A`; cookie C, item ใน C และ `nav-cart-link` "(2)" ไม่เปลี่ยน | pass | pass | `02-after-join-account-orders.png`, `qa-03-mobile-375-no-default-shipping.png`; e2e (A) ของ builder + QA flow จริง (login ผ่านฟอร์ม, cart เดิม 2 ชิ้นจาก PDP) |
| AC-28 B: ไม่มีที่อยู่ → join disabled + `group-add-address-link`, ไม่มี cart ใหม่ | pass | pass | e2e (B) |
| AC-28: รวมเกิน `max_units_per_person` → `group-units-limit` + disabled, ไม่มี cart ใหม่ | pass | pass | `03-units-limit.png`; e2e + QA 375px |
| AC-28: 409 `GB_GROUP_FULL` / `GB_UNITS_LIMIT_EXCEEDED` → `group-join-error` ข้อความไทยตาม code, C ไม่เปลี่ยน; กด join ซ้ำหลัง error ไม่ค้าง | pass | pass | `04-group-full-error.png`; e2e ×2 + QA |
| AC-47 (unit): static test ครอบ `group-buy/components` | pass | pass | vitest 44/44; positive control: ลบ `syncAffiliateBefore` แล้ว test ล้ม |
| AC-47 (e2e): cookie `aff` → draft order `metadata.affiliate_token` | pass | pass | e2e (A) + QA |
| AC-47 (e2e): ยังไม่ login กด join → หน้า login (`login-page`) ไม่มี server action/cart ใหม่ | pass | pass | e2e |
| 29c: แก้จำนวน/ลบรายการ/เปลี่ยนที่อยู่หลังโหลดวิธีส่ง → วิธีส่งหาย, join disabled, โหลดใหม่ได้ cart ใหม่ | pass | pass | QA |
| 29c (D1): dropdown วิธีส่งไม่มีค่าเลือกไว้ก่อน (`เลือกวิธีจัดส่ง`), join disabled จนกว่าจะเลือก; draft order ได้วิธีส่งที่เลือก (Standard ฿10, `shipping_total = 10`) | **fail** | pass | `qa-03-mobile-375-no-default-shipping.png`; QA |
| 29e: กลุ่มเลย `ends_at` → ไม่มีปุ่ม join/ลิงก์แชร์ | pass | pass | QA |
| 29f (D2): หมดเวลาระหว่างอยู่บนหน้า → `group-join-error` "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว", ไม่มีปุ่ม join, ไม่มี membership | **fail** | pass | `qa-04-expired-midway-error.png`; QA + e2e ของ builder |
| 31: variant ซ้ำรวมจำนวน; จำนวน 0/ว่าง/ติดลบ → 1, 999 → 100 | pass | pass | QA |
| 375px ไม่เลื่อนแนวนอน, ข้อความไทยตาม regex (หา element ด้วย `data-testid`) | pass | pass | QA |

## Defect
- **D1 แก้แล้ว (รอบ 2):** รอบ 1 หน้ากลุ่มเลือก "Digital delivery — ฿0" (option ตัวแรก) ไว้ให้สินค้าที่ต้องจัดส่ง ทำให้ draft order ได้ `shipping_total = 0`
- **D2 แก้แล้ว (รอบ 2):** รอบ 1 กลุ่มหมดเวลาระหว่างอยู่บนหน้าแล้ว `GroupJoin` ถูกถอดออกเมื่อหน้า re-render ทำให้ไม่เห็น `group-join-error`
- ไม่มี defect ที่ยังเปิดอยู่

## ข้อสังเกต (ไม่ block)
- "Digital delivery — ฿0" ยังอยู่ในรายการวิธีส่งของสินค้าที่ต้องจัดส่ง ลูกค้าเลือกเองได้ (ปัญหาเดิมที่หน้า checkout ก็มี) — ควรเปิด task แยกเพื่อกรองตาม shipping profile
- การกด "เลือกวิธีจัดส่ง" แต่ละครั้งสร้าง cart ใหม่ (ทดสอบได้ 3 ใบ ใช้จริง 1 ใบ) สอดคล้องกับกฎ 29c ที่ยอมรับไว้สำหรับ v1
- รายการใน `group-selection` แสดงเฉพาะชื่อ variant ("S", "M") ไม่มีชื่อสินค้าหรือราคา

Playwright report และ trace ฉบับเต็ม: CI artifact ของ PR #238 job `storefront-e2e`
