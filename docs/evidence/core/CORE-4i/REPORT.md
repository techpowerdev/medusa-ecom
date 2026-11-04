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

---

# QA — CORE-4i-b (PR #305, head `035849b`)

spec: `docs/spec/01-core-medusa.md` กฎข้อ 72, AC-110 / spec 06 กฎข้อ 9 (d)/(d2), PAY-3b1/3b2 · prod build (`medusa build/start` + `next build/start`) · Chromium 1280×800 และ 375×812 · UI ตรวจภาษาไทยด้วย regex `[฀-๿]` · Stripe test mode (`sk_test_` + `stripe listen`; ไม่มี `pk_test_` ในเครื่อง QA)
โฟลเดอร์นี้มีรูปของ 4i-a ครบ 5 รูปแล้ว (เพดาน evidence) จึงไม่เพิ่มรูปของ 4i-b — screenshot และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #305 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-110 checkout: สลับวิธีชำระ บัตร → พร้อมเพย์ → บัตร (session จริง) ทั้ง 1280 และ 375 | pass — ปุ่มพ้นสถานะ loading ใน 1.3–2.4 วินาที (ไม่ต้องพึ่ง `router.refresh` สำรอง), cart ใน backend มี session pending ตัวเดียวของ provider ล่าสุด, ไม่มี `payment-session-pending-error`, จากนั้นเปลี่ยนเป็น manual → review → ได้ order | e2e QA (CI artifact) |
| AC-110 checkout: เลือกบัตรตอน JWT หาย | pass — `payment-method-error-message` = `SIGN_IN_AGAIN_MESSAGE` | e2e QA |
| AC-110 checkout: action สร้าง session ล้มระดับ network | pass — ขึ้นข้อความไทย "ตั้งค่าการชำระเงินไม่สำเร็จ…" และปุ่มไม่ค้าง | e2e QA |
| AC-110 `placeOrder`: complete ล้มจริง (เปลี่ยน session เป็นบัตรที่ยังไม่ยืนยันผ่าน API แล้ว Medusa ตอบ 400 "not authorized") | pass — ขึ้นข้อความไทยใน `manual-payment-error-message` ไม่เงียบ, cart ยังไม่ complete, ปุ่มกดได้ | e2e QA |
| AC-110 `placeOrder`: action ตอบ 500 (`page.route`) | pass — ขึ้นข้อความไทย, กดใหม่แล้วได้ order | e2e QA |
| AC-110 `placeOrder`: JWT หาย | pass — แสดง `SIGN_IN_AGAIN_MESSAGE` | e2e QA |
| AC-110 / กฎ 9: `/pay` 401 จริง (ลบ `_medusa_jwt` ก่อนเลือกบัตร) | pass — ไปหน้า login ตามกฎ 9 และไม่อ่าน GB-8 (ไม่เข้า d2) ดู O-1 | e2e QA |
| กฎ 9(d): `/pay` ได้ 409 `PAYMENT_ALREADY_COMPLETED` จริง (ยืนยัน PI บัตรผ่าน Stripe API, webhook capture แล้ว จากนั้นเลือกพร้อมเพย์บนหน้าเดิม) — 375 | pass — backend ตอบ 409, ผลของ action มี code นี้, ขึ้น `order-pay-awaiting` แล้วเป็น `order-pay-paid` ไม่มี error | e2e QA |
| กฎ 9(d2): `/pay` network ล้ม / HTTP 500 ของ action | pass — `order-pay-error` ไทยพร้อมฟอร์มเดิม และอ่าน GB-8 ครั้งเดียว ไม่ poll ต่อ | e2e QA |
| `/pay` กดบัตรซ้ำ + กดพร้อมเพย์ระหว่างส่ง | pass — action สร้าง session 1 ครั้ง, GB-8 มี session 1 ตัว | e2e QA |
| group-join: JWT หายก่อนกด join | pass — `group-join-error` = `SIGN_IN_AGAIN_MESSAGE` ไม่มี membership | e2e QA |
| group-join: `setShippingMethod` ล้ม (action 500) | pass — ขึ้น "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่" ไม่ยิง join ต่อ ไม่มี membership | e2e QA |
| regression: core-14-buy-login, core-14f, core-14g (AC-120), core-19a/b (AC-64)/c, core-41, core-4e, core-4g (AC-99/100), ev-7c, flash-sale-fs15 (AC-22), group-buy-join, payments* (AC-9, AC-6 refund, AC-19/AC-20 ส่วน mock), thai-ui-checkout | pass — 62 passed (AC-6 refund ล้มรอบแรกเพราะเครื่อง QA ปิด admin ไว้ เปิด admin แล้วรันซ้ำผ่าน) | ผล Playwright |
| AC-1/2/3/4/5, AC-7, AC-12/12b, AC-17, AC-19 บัตร (Stripe UI), AC-64 พร้อมเพย์ (14 test) | skip ในเครื่อง — ไม่มี pk_test ต้องดูผลจาก CI ที่มี secret | CI |
| unit storefront (vitest) | pass — 1017/1017 (85 ไฟล์) | — |

## Negative / edge
- กดปุ่ม Continue สองครั้ง แล้วกดยืนยันคำสั่งซื้อสองครั้ง: ได้ order เดียว ผ่าน
- สร้าง session ตอน network ล้ม (checkout และ `/pay`): ไม่ค้าง และลองใหม่ได้ ผ่าน
- จ่ายแล้วแต่หน้ายังเป็นฟอร์มเดิม (race กับ webhook): 409 พาเข้าทาง poll ไม่ตัดเงินซ้ำ ผ่าน

## Defect
ไม่พบ

## Observation
- **O-1:** `/pay` กรณี 401 ผู้ใช้จะไม่เห็น `SIGN_IN_AGAIN_MESSAGE` เพราะ `router.refresh()` เปลี่ยนเป็นหน้า login ทันที และหน้า login ก็ไม่ได้บอกเหตุผล พฤติกรรมนี้ตรงกับกฎ 9 (401 → หน้า login) แต่ไม่ตรงกับที่ PR body เขียนว่า "แสดงใน `order-pay-error`" ถ้าอยากให้ผู้ใช้เห็นเหตุผล ให้ส่ง `reason` แบบ CORE-4h ไปที่หน้า login (follow-up)
- **O-2:** เส้นทาง `type: "cart"` จริงทำให้เกิดในเครื่องไม่ได้ (Medusa 2.22.1 ตอบ 400 ตอน authorize ไม่ผ่าน) เส้นทางนี้ครอบด้วย unit test ของ PR เท่านั้น ส่วนที่ผู้ใช้เห็นของเส้นทาง 400/500 ผ่าน
- **O-3:** เมื่อไม่มี pk ช่องกรอกบัตรแสดงเป็น skeleton (ข้อจำกัดของ env ในเครื่อง ไม่ใช่ผลของ PR)

## สรุป
AC-110 ส่วนการชำระเงิน และกฎ 9 (d)/(d2)/401 ผ่านบน prod build การเอา `cache: "no-store"` ออกไม่ทำให้ cart ค้าง เพราะ cart ใหม่มาถึงภายใน 2.4 วินาทีทุกครั้งที่สลับวิธีชำระ ไม่พบ defect ส่วน e2e ของ Stripe UI (บัตร 4242, QR พร้อมเพย์, การต่ออายุ QR) ยืนยันด้วย CI ที่มี secret ครบ
