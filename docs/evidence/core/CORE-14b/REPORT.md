# QA CORE-14b — PR #113 (`feat/CORE-14b-nojs-add-variant` @ a6811cd)

Spec: `docs/spec/01-core-medusa.md` — AC-44, AC-45, กฎ 26
สภาพแวดล้อม: production build ในเครื่อง (backend `medusa start` :9134, storefront `next start` :8134), DB `medusa_qa113`
(migrate + seed ใหม่), Redis db 14, Node 22.23.3, Playwright chromium; ไม่ใช้ Stripe (feature ไม่เกี่ยวกับการชำระเงิน)
Test: `apps/storefront/e2e/core-14b-add-variant.spec.ts` (ของ PR, 3 passed) และ QA checklist spec ในเครื่อง
(15 passed) — หา element ด้วย `data-testid`, ตรวจความเป็นไทยด้วย regex อักษรไทย
report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน) ของ run บน PR #113

## Acceptance criteria

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-44 ปิด JS ไม่มี session, quantity 3 → HTML `/account?add_variant=…` มีฟอร์ม login; login แล้ว cart quantity=3 | ผ่าน | `01-nojs-login-after-add.png`, `02-nojs-cart-quantity-3.png` (header ตะกร้า (3)); test PR AC-44 + QA-1, QA-2 (API + DB) |
| AC-45 ล็อกอินแล้วเปิด `/account?add_variant=variant_ไม่มีจริง` → `add-variant-error` ภาษาไทย, cart ไม่เปลี่ยน (เปิด/ปิด JS) | ผ่าน | `03-add-variant-error-nojs.png`; test PR AC-45 (JS on/off) |

## Checklist ใน PR

| # | รายการ | ผล | หลักฐาน |
|---|--------|----|---------|
| 1 | ปิด JS: PDP → quantity 3 → Add to cart → หน้า login ทันที (ไม่มี spinner) URL มี `add_quantity=3` | ผ่าน | QA-1, `01-nojs-login-after-add.png` |
| 2 | login ต่อแบบปิด JS → `/th/cart`, cart มี 3 ชิ้น | ผ่าน | QA-2 (API + DB: 1 line qty 3), `02-nojs-cart-quantity-3.png` |
| 3 | เปิด JS: Add to cart → login → cart มีสินค้า quantity 1 | ผ่าน | QA-3 |
| 4 | login แล้วเปิด `add_variant=variant_ไม่มีจริง` เปิด/ปิด JS → error ไทย, cart ไม่เปลี่ยน | ผ่าน | test PR AC-45 ×2, `03-add-variant-error-nojs.png` |
| 5 | ไม่ login เปิด `add_variant=variant_ไม่มีจริง` → error เหนือฟอร์ม login; login → หน้าบัญชีพร้อม error, ไม่เพิ่มลง cart | ผ่าน (เปิดและปิด JS) | QA-5 no-JS, QA-5 JS, `05-qa-js-error-after-login.png` |
| 6 | mobile 375px: กล่อง error ไม่ล้นจอ | ผ่าน (ไม่ล็อกอิน/ล็อกอิน) | QA-6, `04-qa-mobile-375-error.png` |

## Negative / edge case (นอก spec)

| กรณี | ผล | หมายเหตุ |
|------|----|----------|
| EDGE-1 stock 2 แต่ `add_quantity=3` (ปิด JS) | ผ่าน | หน้า login แสดง error; login → เพิ่มลง cart ล้ม → redirect `/th/account?add_variant=…&add_quantity=3` พร้อม error, cart ว่าง |
| EDGE-2 stock 2, `add_quantity=2` | ผ่าน | ไม่มี error, cart 2 ชิ้น |
| EDGE-3 `add_quantity` = `0`, `-5`, `abc`, `1000` | ผ่าน | ไม่มี 5xx, clamp เป็น 1, 1, 1, 100 |
| EDGE-4 ล็อกอินแล้วเปิด `/account?add_variant=<ขายได้>&add_quantity=3` | ผ่าน | ไม่แสดง error และไม่แก้ cart (GET ไม่มี side effect) |
| EDGE-5 เปิด JS กด sign-in สองครั้งติด (`add_quantity=3`) | ผ่าน | cart 3 ชิ้น ไม่ใช่ 6 |

## Defect

ไม่พบ defect ที่ทำให้ AC ไม่ผ่าน

ข้อสังเกต (PR ระบุใน "นอกขอบเขต" แล้ว): ปิด JS หลัง login หน้า `/th/cart` ค้างที่ skeleton ของ `cart/loading.tsx`
(header แสดง ตะกร้า (3)) — ควรเปิด task ต่อเนื่องตามที่ PR เสนอ
