# QA REPORT — CORE-19d (PR #160) deleteLineItem คืนผลแบบมีโครงสร้าง + DeleteButton แยก unauthorized

- spec: `docs/spec/01-core-medusa.md` (origin/develop) กฎข้อ 68, AC-104 (+ regression AC-100, AC-62)
- สภาพแวดล้อม (ทั้งสองรอบ): prod build (`medusa build`+`medusa start`, `next build`+`next start`), DB seed ใหม่, Redis db แยก, Stripe key ปลอม, Chromium 1280×720 และ 375×812, ลูกค้าล็อกอินมี cart 2 line
- CI: รอบ 1 (`7295b28`) https://github.com/techpowerdev/medusa-ecom/actions/runs/40511565328 ; รอบ 2 (`106ff30`) https://github.com/techpowerdev/medusa-ecom/actions/runs/40514784604 (Playwright report/trace ฉบับเต็มใน artifact `e2e-evidence` เก็บ 14 วัน)
- test ของ QA รันในเครื่อง ไม่ได้ commit

## สรุป
| รอบ | commit | ผล |
|-----|--------|----|
| 1 | `7295b28` | AC-104 unit pass, JWT ค่าขยะ → "เข้าสู่ระบบใหม่" pass, AC-100 pass, AC-62 pass; พบ D-1 (ลบ cookie JWT → ได้ข้อความ fallback) |
| 2 | `106ff30` | D-1 ปิด — ทุก AC pass ไม่มี defect ค้าง |

## ผลตาม AC (รอบ 2, `106ff30`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-104 unit: 401/403 → `unauthorized`, 500/network/ไม่มี id → `failed`, ไม่มี JWT → `unauthorized` (ไม่เรียก SDK), สำเร็จ → `{ ok: true }` ไม่ throw; DeleteButton ข้อความไทยต่างกัน | pass | Vitest `delete-line-item.test.ts` 7/7, `delete-button.test.ts` 5/5 |
| AC-104 e2e (prod): ลบ cookie `_medusa_jwt` คง `_medusa_cart_id` → "ลบสินค้าไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่", spinner หาย, line ยังอยู่ (UI+backend) — `/th/cart` 1280/375, dropdown 1280 | pass | qa-05-jwt-removed-unauthorized-375.png; `core-19c-delete-button-error.spec.ts` AC-104 |
| AC-104 e2e (prod): JWT ค่าขยะ คง cart id → "เข้าสู่ระบบใหม่" — `/th/cart` 1280/375, dropdown 1280 | pass | qa-03-cart-jwt-invalid-unauthorized-375.png, qa-04-dropdown-jwt-invalid-unauthorized-1280.png |
| AC-100 (regression): action ตอบ 500 → fallback "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", spinner หาย, line ยังอยู่ — dropdown + `/th/cart` 1280/375 | pass | qa-02-cart-remove-500-fallback-1280.png; `core-19c-delete-button-error.spec.ts` 5/5 |
| AC-62 (regression): ลบสำเร็จใน dropdown และ `/th/cart` (1280/375) → nav (1) ภายใน 5 วินาทีโดยไม่ reload, backend เหลือ 1 line | pass | qa-01-dropdown-remove-success-1280.png; `core-19a-nav-cart-search.spec.ts` 8/8 (serial 3 รอบ) |

## Layout (ทั้งสองรอบ)
| ตรวจ | 1280px | 375px |
|------|--------|-------|
| error (fallback/unauthorized) ≤ 2 บรรทัด ไม่ทับปุ่มลบ/select ไม่ล้นจอ ไม่มี scroll แนวนอน (`/th/cart`) | pass | pass |
| error ใน dropdown ไม่ทับปุ่ม "ลบ" | pass | ไม่มีให้ตรวจ (dropdown `hidden small:block`) |

## Negative / edge case
| กรณี | ผล | หมายเหตุ |
|------|----|----------|
| double-click ลบใน `/th/cart` | pass | delete action 1 ครั้ง ลบ 1 line |
| double-click ลบใน dropdown | pass | delete action 1 ครั้ง |
| token ของลูกค้าอื่น (ไม่ใช่เจ้าของ cart) | pass | backend 404 → fallback ไทย line ไม่ถูกลบ (กฎข้อ 68: เฉพาะ 401/403 = unauthorized) |
| ลบล้ม (500) แล้วกดลบใหม่สำเร็จ | pass | error หายและ line ถูกลบ |
| ลบ cookie JWT คง cart id | รอบ 1 fail (D-1) / รอบ 2 pass | ดูด้านล่าง |

## Defect
**D-1 (ปิดในรอบ 2, `106ff30`)** ลบ cookie `_medusa_jwt` แต่คง `_medusa_cart_id` แล้วกดลบ → รอบ 1 ได้ข้อความ fallback แทน "…กรุณาเข้าสู่ระบบใหม่"
- สาเหตุ: POST ของ server action ผ่าน middleware → `clearStaleCartCookie` ล้าง `_medusa_cart_id` (ไม่มี JWT) → `getCartId()` ว่าง → คืน `{ error: "failed" }` โดยไม่ยิง backend
- แก้: `deleteLineItem` เช็กว่าไม่มี JWT → `unauthorized` ก่อนเช็ก cart id (+ unit test และ e2e AC-104)

หมายเหตุรอบ 2: `core-19a` "AC-62 (UI flow, D-1) S+M" timeout 30 วินาที 1 ครั้งเมื่อรัน 2 worker พร้อมกันในเครื่อง; รัน serial ซ้ำ 3 รอบผ่าน 8/8 ทุกรอบ — flaky จากโหลดเครื่อง ไม่ใช่ regression
