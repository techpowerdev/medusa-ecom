# Evidence: CORE-4i-a — server action ในตะกร้าคืนผลแบบมีโครงสร้าง + `SIGN_IN_AGAIN_MESSAGE` (QA PR #222)

- Spec: `docs/spec/01-core-medusa.md` — AC-110 (ส่วน 4i-a), กฎข้อ 72 (owner Q-C2 = ก)
- PR: #222 — branch `refactor/CORE-4i-structured-cart-actions`
- สภาพแวดล้อม: prod build (`medusa start` + `next start`), node 24.12.0, ลูกค้า login, Stripe test mode เท่านั้น; หา element ด้วย `data-testid`
- รายงาน/trace ฉบับเต็ม: CI artifact ของ PR #222 (14 วัน)

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-110 (1) ลบ `_medusa_jwt` (คง `_medusa_cart_id`) → ใส่โค้ด/แก้จำนวน/ลบสินค้า แสดง `SIGN_IN_AGAIN_MESSAGE` | fail — D-1 (ปัญหาเดิมบน develop, owner ยอมรับ 2026-11-03 ไม่บล็อก PR นี้ → follow-up CORE-14g) | `ac1-defect-empty-cart-jwt-removed.png` |
| AC-110 (1b) JWT ไม่ถูกต้อง (backend 401) → ทั้งสามแสดง "กรุณาเข้าสู่ระบบอีกครั้ง" | pass | `ac1-signin-again-invalid-jwt.png` |
| AC-110 (2) server action 500 / network abort → fallback ไทยทั้งสามจุด ไม่มีอังกฤษ (1280 + 375px) | pass (4/4) | `ac2-fallback-500-375.png` |
| AC-110 (3) โค้ดธรรมดา + `GB-*` → ข้อความไทยของ `PROMOTION_NOT_COMBINABLE`, cart มีโค้ดแรกตัวเดียว | pass | `ac3-not-combinable.png` |
| AC-110 (4) ลบโค้ดส่วนลดล้ม (500) → `promotion-error` ไทย, โค้ดยังอยู่ | pass | `ac4-remove-discount-failed.png` |
| AC-110 (5) regression: ใส่/ลบโค้ด, เปลี่ยนจำนวน, ลบสินค้าสำเร็จ ไม่มี error; e2e AC-99, AC-100, AC-104, AC-21, AC-22, AC-1/2/3 (checkout manual), AC-48/75, AC-6, AC-4 | pass 14/14 | ผล test |
| AC-110 (6) 375px error อยู่ในจอ ไม่มี scroll แนวนอน | pass | `ac2-fallback-500-375.png` |

Edge: กดใช้โค้ดสองครั้งเร็วๆ → โค้ดเข้าครั้งเดียว (pass); ช่องว่างไม่ส่ง, โค้ดที่ไม่มีจริง → ข้อความไทย (pass)

## Defect
- **D-1 (ปัญหาเดิม — ไม่ใช่ regression ของ #222):** ลูกค้า login มี 2 line → `/th/cart` → ลบ `_medusa_jwt` แต่ `_medusa_cart_id` ยังอยู่ → ใส่โค้ด / เปลี่ยนจำนวน / ลบโค้ด → response ของ server action มี `set-cookie: _medusa_cart_id=; Max-Age=0` จาก `clearStaleCartCookie` (`lib/util/stale-cart-cookie.ts`, middleware CORE-14) → Next render `/cart` ใหม่ในจังหวะที่ไม่มี cart id → ตะกร้าว่างทับผล `{ error: "unauthorized" }` ที่ action คืนถูกต้อง (cart ใน backend ยังอยู่)
  - builder ยืนยันว่าเกิดเหมือนกันบน `origin/develop` (a2fa0fc) รวมถึง `deleteLineItem` ของ CORE-19d (e2e AC-104 ผ่านเพราะจังหวะ prefetch)
  - ทางแก้ที่ทดลองแล้ว: `clearStaleCartCookie` ไม่ล้าง cookie เมื่อ request มี header `next-action` (AC-43 ยังเป็นไปตามเดิมเพราะล้างใน GET/RSC ถัดไป) → task CORE-14g
- O-1: ใส่/ลบโค้ดแล้ว server ตอบ 500 / network ล้ม ขึ้น "ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง" ชวนเข้าใจว่าโค้ดผิด — follow-up copy
- O-2: ลบโค้ดล้มขณะช่องโค้ดปิด → เงียบจนกว่าจะเปิดช่อง (ตามที่ PR ระบุ)
