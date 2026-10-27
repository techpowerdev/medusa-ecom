# รายงาน QA — CORE-14c (PR #117)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 40, AC-76, AC-41/AC-42 (nit review #81 — ใช้เลข AC ตาม PR body: AC-41 = `/buy` 303, AC-42 = `/ucp/v1` 307/308 → 404)
- Commit ที่ตรวจ: `95bd371` (branch `feat/CORE-14c-login-foreign-cart`)
- สภาพแวดล้อม: worktree แยก, backend `medusa build && medusa start` :9136, storefront `next build && next start` :8136, DB `medusa_qa117` (seed CORE-2), Redis db 11, Stripe key ปลอม (flow นี้ไม่ใช้ Stripe)
- report/trace ฉบับเต็ม: CI artifact ของ PR #117 (เก็บ 14 วัน)

## ผลต่อ AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-76 (e2e) — jwt ค้าง + cookie `_medusa_cart_id`=CB ของ B → A login ผ่านฟอร์ม → เห็น `customer-email` ของ A, ไม่มี `login-error-message`, cookie ถูกล้าง (ไม่ชี้ CB), `CB.customer_id` ยังเป็น B และสินค้าใน CB ไม่เปลี่ยน | pass | `01-login-with-foreign-cart-cookie.png`, `qa-01-account-a-after-foreign-cookie.png`; e2e `core-14c-login-foreign-cart.spec.ts` + QA spec ผ่าน |
| AC-76 (unit) — transfer ได้ 404 → login สำเร็จ + ล้าง cookie; 500/network → error ถูกส่งต่อ ไม่ล้าง cookie; สำเร็จ → คง cookie | pass | Vitest `src/login-foreign-cart.test.ts` ผ่าน 4/4 |
| AC-76 checklist — เปิด `/th/cart` หลัง login → 200, เห็น `empty-cart-message` (มีอักษรไทย), ไม่มี `product-row` ของ B | pass | `qa-02-cart-after-login.png` |
| AC-76 checklist — `/buy/<variant>:1` ในสภาพ jwt ค้าง + cookie CB → 303 ไป `/th/account?return_to=...` → login → `/th/checkout` (`checkout-container`), cart ใหม่เป็นของ A มี variant ×1, CB ยังเป็นของ B | pass | `qa-03-buy-checkout-foreign-cookie.png` |
| AC-41 (nit) — `/buy` ไม่มี session: redirect แรกเป็น `303` + `location` = `/th/account?return_to=/buy/...` ก่อนตาม redirect | pass | e2e `core-14-buy-login.spec.ts` AC-41 ผ่าน; curl: `303 → /th/account?return_to=%2Fbuy%2F...` |
| AC-42 (nit) — `/ucp/v1`: redirect แรก `307` ไป `/th/ucp/v1` แล้วปลายทาง `404` | pass | e2e AC-42/AC-56 ผ่าน; curl: `/ucp/v1 307 → /th/ucp/v1`, `/th/ucp/v1 404` |

Red check: build ด้วย `customer.ts` ของ `develop` (ไม่มี fix) แล้วรันซ้ำ → AC-76 e2e ของ PR และ QA checklist **fail** ทั้ง 3 test (cookie ยังชี้ CB; flow `/buy` ค้างอยู่หน้า login ไปไม่ถึง checkout) ยืนยันว่า test จับปัญหาได้จริง

## Negative / edge case (นอก spec)

| กรณี | ผล | หมายเหตุ |
|------|----|----------|
| กด `sign-in-button` สองครั้งติด (dblclick) ขณะมี cookie CB | pass | login สำเร็จ ไม่มี error, CB ยังเป็นของ B |
| cookie ชี้ cart id ที่ไม่มีอยู่จริง | pass | login สำเร็จ, cookie ถูกล้าง |
| cookie ชี้ cart ของ A เอง (regression) | pass | login สำเร็จ, cookie คงเดิม, cart ยังมีสินค้า |
| login แล้วตั้ง cookie CB ใหม่ขณะยังมี session A → `/th/cart` | pass | 200, ไม่แสดงสินค้าของ B, CB ไม่ถูกโอน |
| รหัสผ่านผิดขณะมี cookie CB | ข้อสังเกต (นอกขอบเขต PR นี้) | `login-error-message` = "Invalid email or password" (ข้อความดิบจาก backend ไม่มีอักษรไทย); CB ไม่ถูกแตะ — `completeLogin` ไม่อยู่ใน diff |

## ข้อสังเกตเพิ่มเติม (ไม่ใช่ defect ของ PR นี้)
- หน้า checkout ยังมีข้อความอังกฤษ ("Shipping Address", "Delivery", "Payment", "In your Cart", "Add Promotion Code(s)") ณ commit ที่ตรวจ — แปลไทยใน CORE-4d (#109)
- QA spec ที่ใช้ไม่ได้ commit (7 test: 6 pass, 1 ข้อสังเกตด้านบน)
