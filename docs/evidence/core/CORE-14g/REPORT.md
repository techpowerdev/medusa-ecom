# QA — CORE-14g: ไม่ล้าง `_medusa_cart_id` ใน request ของ server action (PR #234)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 84, AC-120 (และ regression AC-43, AC-110 ข้อ 1 / AC-104)
- Branch: `fix/CORE-14g-action-cookie-guard` @ `83a662a`
- สภาพแวดล้อม: prod build (`medusa start` จาก `.medusa/server` และ `next build && next start`), Node 22, Stripe test mode
- วิธีตรวจ: Playwright (chromium) หา element ด้วย `data-testid` ตรวจข้อความด้วย constant `SIGN_IN_AGAIN_MESSAGE` และ regex อักษรไทย `[฀-๿]`
- report/trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #234 (เก็บ 14 วัน)

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-120 unit (POST ที่มี `next-action` ไม่ล้าง, GET รวม GET ที่มี `next-action` ล้าง, มี JWT ไม่ล้าง) | pass | vitest `stale-cart-cookie.test.ts` ผ่าน 7/7 |
| AC-120 e2e desktop: ลบ `_medusa_jwt` บน `/th/cart` แล้ว (1) แก้จำนวน (2) ลบโค้ด (3) ใส่โค้ด (4) ลบสินค้า — ทุกครั้งขึ้น `SIGN_IN_AGAIN_MESSAGE` (ไทย) แถวสินค้ายังอยู่ request ของ action ส่ง cookie cart response ไม่มี `Set-Cookie: _medusa_cart_id=; Max-Age=0` cookie ใน browser เป็นค่าเดิม cart ใน backend ไม่เปลี่ยน | pass (QA spec รันซ้ำ 6 รอบ ผ่าน 6/6) | qa-01-ac120-desktop-sign-in-again.png |
| AC-120 e2e ที่ 375px (ขั้นตอนเดียวกัน) | pass | qa-04-ac120-mobile-375.png |
| AC-120 ช่วงท้าย และ AC-43: reload `/th/cart` → cookie cart ถูกล้าง ขึ้น `empty-cart-message` ไม่มี 5xx | pass | qa-02-ac43-reload-empty.png |
| AC-43 เดิม (`core-14-buy-login.spec.ts`) | pass | output ของ Playwright |
| AC-110 ข้อ 1 / AC-104 (`core-19c-delete-button-error.spec.ts`) | pass | output ของ Playwright |
| e2e ของ builder `core-14g-action-stale-jwt.spec.ts` | **flaky** (รัน `--repeat-each=8` ล้ม 5/8 รันเดี่ยวผ่าน) | ดู D-1 |

regression อื่นที่รันซ้ำบน prod build ผ่านทั้งหมด 18/18: core-14c (AC-76), core-14d (AC-92/93), core-4f (AC-98), core-4g (AC-99), thai-ui-cart-order (AC-48/78)

## Negative / edge case
| กรณี | ผล |
|------|----|
| curl `POST /th/cart` ใส่ `next-action: bogus` มี cookie cart แต่ไม่มี JWT | ได้ 404 และไม่ล้าง cookie — ไม่กระทบความปลอดภัย เพราะ action เช็ก JWT ก่อน cart id และ backend บังคับ owner |
| curl `GET /th/cart` ใส่ `next-action: x` | ล้าง cookie (`Max-Age=0`) ตามกฎข้อ 84 |
| curl `POST /th/cart` ไม่มี `next-action` | ล้าง cookie |
| ดับเบิลคลิกลบสินค้าหลังลบ JWT | ขึ้นข้อความเดียว แถวยังอยู่ backend ไม่เปลี่ยน — pass |
| ลบ JWT แล้ว hover ลิงก์บน nav (เกิด prefetch) ก่อนทำ action | ทั้ง 4 action ยังขึ้น `SIGN_IN_AGAIN_MESSAGE` และแถวยังอยู่ — pass |

## Defect
**D-1 (อยู่ที่ test ไม่ใช่โค้ดแอป) — e2e AC-120 ของ builder flaky**
- ทำซ้ำ: `npx playwright test e2e/core-14g-action-stale-jwt.spec.ts --repeat-each=8 --workers=1` บน prod build
- Expected: ผ่านทุกรอบ
- Actual: ล้ม 5/8 ที่ step (1) ตรง assertion `"browser ยังมี cookie cart"` (Received false)
- สาเหตุจาก trace: test ลบ `_medusa_jwt` ทันทีหลังเปิดหน้า ขณะที่ link prefetch (`GET …?_rsc=` ที่มี `next-router-prefetch`) ของ `/th/cart` และ `/th/checkout` ยังวิ่งอยู่ → middleware ล้าง cookie ตาม AC-43 (ถูกตาม spec) ตัวที่ล้างไม่ใช่ response ของ action
- แนวทางแก้: รอ `page.waitForLoadState("networkidle")` ก่อน `clearCookies` — QA spec ที่ทำแบบนี้ผ่าน 6/6
- **สถานะ: แก้แล้ว** ใน `57d5ab4` (owner เลือกแก้ที่ test ไม่แก้ middleware) รัน `--repeat-each=8` บน prod build ผ่าน 8/8 และ CI `storefront-e2e` ของ head `0ab013d` ผ่าน

## Observation (นอก scope AC-120)
- **O-1 `promotion-error` ไม่แสดงเมื่อช่องใส่โค้ดปิดอยู่** — ลบ JWT แล้วกดลบโค้ดตอนช่องปิด: action ตอบแล้วแต่หน้าไม่มีข้อความใด โค้ดยังอยู่ ผู้ใช้ไม่รู้ว่าทำไมลบไม่ได้ (error render อยู่ใต้ `isOpen` ใน `modules/checkout/components/discount-code`) เสนอเป็น task ใหม่ — qa-05-obs-promotion-error-hidden.png
- **O-2 login ใหม่แล้วตะกร้าเดิมไม่กลับมา** — เห็น `SIGN_IN_AGAIN_MESSAGE` แล้วกด "บัญชี": RSC GET `/th/account` ล้าง cookie cart ตาม AC-43 → login สำเร็จแต่ `/th/cart` ว่าง ทั้งที่ cart เดิมยังอยู่ใน backend และเป็นของ customer คนนี้ spec ไม่ได้กำหนดเรื่องกู้ cart หลัง login จึงไม่นับเป็น fail ของ AC-120 เสนอให้ planner พิจารณา — หน้าจอหลัง login เหมือน qa-02 ทุกประการ (ตะกร้าว่าง) จึงไม่เก็บรูปแยก

## สรุป
AC-120 ผ่านทั้ง desktop และ 375px บน prod build ส่วน AC-43 และ AC-110 ข้อ 1 (AC-104) ไม่เสีย พบ defect ด้าน test 1 ข้อ (D-1) แก้แล้วก่อน merge

งานต่อเนื่อง: O-1 → CORE-28, O-2 → CORE-29 (ADR-019) เปิดใน PR #240
