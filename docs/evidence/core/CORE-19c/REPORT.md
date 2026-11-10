# QA REPORT — CORE-19c (PR #142) `DeleteButton` ส่งต่อ data-testid + แสดง error เมื่อลบล้ม

- spec: `docs/spec/01-core-medusa.md` (origin/develop) กฎข้อ 64, AC-100 (+ regression AC-62)
- สภาพแวดล้อม (ทั้งสองรอบ): prod build (`medusa build` + `medusa start`, `next build` + `next start`), DB seed ใหม่, Redis db แยก, Stripe key ปลอม, Chromium 1280×720 และ 375×812, ลูกค้าล็อกอินและมี cart 2 line
- CI ของ PR (head `203141a`): https://github.com/techpowerdev/medusa-ecom/actions/runs/40489510769 (Playwright report/trace ฉบับเต็มใน artifact `e2e-evidence` เก็บ 14 วัน)
- test ของ QA รันในเครื่อง ไม่ได้ commit

## สรุป
| รอบ | commit | ผล |
|-----|--------|----|
| 1 | `cc7c96f` | AC-100 pass, AC-62 pass; พบ D-1 (401 ไม่ได้ข้อความเฉพาะ) และ D-2 (error ในหน้า cart ถูกบีบ 9 บรรทัด) |
| 2 | `203141a` | AC-100 pass, AC-62 pass, D-1 ปิด, D-2 ปิด — ไม่มี defect ค้าง |

## ผลตาม AC (รอบ 2, `203141a`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-100 (ก) ทุก line ใน cart dropdown (บน `/th` และ `/th/cart`) มี `cart-item-remove-button`, ทุก row หน้า cart มี `product-delete-button` | pass | e2e builder ✓, QA dropdown บน `/th` ✓, `/th/cart` 1280/375 ✓ |
| AC-100 (ข) dropdown: ลบแล้วตอบ 500 → `cart-item-remove-error` ภาษาไทยบรรทัดเดียวใต้ "ลบ", spinner หาย (~0.3 วินาที ≤ 5 วินาที), line ยังเป็น 2 (UI + backend), nav `(2)` | pass | 01-dropdown-remove-error.png (builder); QA ✓ |
| AC-100 (ค) `/th/cart` 1280/375: ลบแล้วตอบ 500 → error ไทยอยู่ใต้ปุ่มลบ/select ≤ 2 บรรทัด, spinner หาย, row/backend ยัง 2, nav `(2)` | pass | 02-cart-page-remove-error.png, 03-cart-page-remove-error-375.png (builder), qa-01-cart-remove-500-375-r2.png |
| AC-62 (regression) ลบปกติใน dropdown → nav `(1)` ภายใน 5 วินาทีโดยไม่ reload | pass | `core-19a-nav-cart-search.spec.ts` 8/8 + QA ✓ |
| AC-62 (regression) ลบปกติในหน้า `/th/cart` → row เหลือ 1, nav `(1)` โดยไม่ reload | pass | QA ✓ |

## Layout (รอบ 2)

| ตรวจ | 1280px | 375px |
|------|--------|-------|
| หน้า cart: error อยู่ใต้ปุ่มลบและ select, ไม่ทับ, ไม่ล้น row, ไม่มี scroll แนวนอน | pass | pass |
| หน้า cart: error ≤ 2 บรรทัด | pass (2 บรรทัด กว้าง 112px) | pass (2 บรรทัด) |
| dropdown: error บรรทัดเดียวใต้ "ลบ" ไม่ล้นกรอบ | pass | ไม่มีให้ตรวจ (dropdown เป็น `hidden small:block` บนมือถือ) |
| หน้า cart ตอนไม่มี error เหมือน develop | pass: ภาพแถวตรงกันทุก byte (sha1 เท่ากัน) | pass |

หมายเหตุ: `<select>` ของ starter เป็น `w-16 h-16` (64×64) ใหญ่กว่า pill ที่เห็น (56×40) ส่วนโปร่งใสเกย error 4px แต่ไม่ทับบนจอ จึงวัดกับ pill

## Negative / edge case

| กรณี | รอบ 1 | รอบ 2 | หมายเหตุ |
|------|-------|-------|----------|
| double-click ปุ่มลบ | pass | pass | server action ยิง 1 ครั้ง, ลบ 1 line |
| session หมดอายุ (JWT ใช้ไม่ได้ → backend 401 จริง) | fail (D-1) | pass | รอบ 2 ขึ้นข้อความกลาง "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" (qa-02-session-expired-401-r2.png); line ไม่ถูกลบ |

## Defect

**D-1 (รอบ 1, ปิดในรอบ 2)** ลบตอนได้ 401 แล้วไม่ขึ้น "กรุณาเข้าสู่ระบบอีกครั้ง" เพราะ `medusaError` ทิ้ง status และใน prod Next ซ่อน error ของ server action — spec ไม่ได้กำหนดข้อความ 401 จึงเปลี่ยนเป็นข้อความกลางทุกกรณี (การแยก 401 จริงส่งเป็น follow-up: server action คืน structured error)

**D-2 (minor, รอบ 1, ปิดในรอบ 2)** error ในหน้า cart ถูกบีบกว้าง 29px เหลือ 9 บรรทัด → แก้ด้วย `flex-wrap` + `!contents` + `basis-full order-last` ตอนนี้ 2 บรรทัด และแถวตอนไม่มี error ไม่เปลี่ยน

## Test ที่รัน (รอบ 2, prod build ในเครื่อง)
- `e2e/core-19c-delete-button-error.spec.ts` (builder): 4/4 passed
- `e2e/core-19a-nav-cart-search.spec.ts` (regression AC-62/63): 8/8 passed
- QA spec (ในเครื่อง): 9/9 passed (รวมการวัด baseline เทียบกับ develop)
