# QA — CORE-48 (PR #300) แก้จำนวนเกิน stock → ข้อความไทยว่าสินค้าไม่พอ

spec: `docs/spec/01-core-medusa.md` กฎข้อ 106, AC-143 · head `0ed7b09` · prod build (backend `medusa start` + storefront `next start`) · Stripe test mode
หา element ด้วย `data-testid` และตรวจข้อความไทยด้วย regex `[฀-๿]` · Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #300 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-143 unit: `isInsufficientInventory` true/false ตาม spec, `updateLineItem` → `{ error: "INSUFFICIENT_INVENTORY" }`, `changeLineQuantity` แยกข้อความ, `checkout-conflict-contract.test.ts` ผ่านโดยไม่แก้ | pass | Vitest 4 ไฟล์ 25/25 |
| AC-143 e2e 375×812: stock 5 ใส่ 3 → เลือก 6/10/99 → `product-error-message` = INSUFFICIENT_INVENTORY_MESSAGE (ตรง regex `[฀-๿]` ไม่ใช่ข้อความทั่วไป), select กลับเป็น 3, Store API = 3, error อยู่ในการ์ดของ line, `scrollWidth` = 375 | pass | 01-cart-375-qty6-insufficient-stock.png |
| AC-143 e2e 1280×800: เหมือนกัน error อยู่ในแถวตาราง ไม่ล้นจอ | pass | 02-cart-1280-qty99-insufficient-stock.png |
| กฎ 106c: หลัง error เลือก 5 (= stock พอดี) → สำเร็จ error หาย Store API = 5; เลือก 6 ซ้ำ → error กลับมา; reload แล้ว error ไม่ค้าง | pass | QA-1 (375/1280) |
| กฎ 106b: action ตอบ 500 / network ล้ม (`page.route` fulfill 500 / abort) → UPDATE_QUANTITY_FAILED, จำนวนคงเดิม; 500 ตอนเลือกเกิน stock ก็ยังเป็นข้อความทั่วไป; ลบ `_medusa_jwt` → SIGN_IN_AGAIN_MESSAGE | pass | 03-cart-375-500-generic-error.png |
| builder spec `core-48-cart-insufficient-stock` รัน `--repeat-each=3` | pass | 6/6 |

## Negative / edge
| กรณี | ผล |
|------|----|
| หลาย variant (S stock 2, L stock 8): S → 3 error เฉพาะแถว S; L → 8 สำเร็จ; L → 9 error แถว L select คง 8; S → 2 สำเร็จ error ของ S หาย; Store API `{S:2, L:8}` | pass — 04-cart-375-multi-variant-row-error.png |
| stock 0: Store API add line-item ได้ 400 `insufficient_inventory`; ปุ่ม `add-product-button` บน PDP disabled "สินค้าหมด" → stock 0 ใส่ตะกร้าไม่ได้ จึงไม่ถึงหน้า /cart | ใส่ตะกร้าไม่ได้ (ตามคาด) |
| เปลี่ยนจำนวนเร็วๆ 10→4 | error ไม่แสดง, select/Store API = 4 |
| เปลี่ยนจำนวนเร็วๆ 1→10 | ข้อความไม่พอ 1 ข้อความ, คง 1 |
| เปลี่ยนจำนวนเร็วๆ 9→10 | ข้อความไม่พอ 1 ข้อความ, คง 1 |
| หน้า checkout (`?step=address`) | มี `product-row` 1 แถว (preview) แต่ไม่มี `product-select-button` จึงแก้จำนวนไม่ได้ ไม่อยู่ในขอบเขต |
| เลือก 99 (ไม่มีใน option 1..10) ด้วยการใส่ option ผ่าน DOM | ข้อความไม่พอ, คง 3 |

## Regression
`core-48`, `core-47`, `core-44`, `core-42`, `thai-ui-cart-order`, `core-19c` — 13/13 pass (2 workers)

## Defect
ไม่มี

## Observation
- O-1: error ของแต่ละ line เป็น state ของแถวนั้น ถ้าแก้แถวอื่นสำเร็จ error ของแถวแรกยังค้างอยู่ จนกว่าจะแก้แถวนั้นสำเร็จหรือ reload ซึ่งตรงกับกฎ 106c ที่ว่า "แก้จำนวนสำเร็จครั้งถัดไป" (ของ line นั้น) ไม่ใช่ defect
- O-2: หลัง action สำเร็จ Store API อัปเดตก่อนที่ select/ยอดรวมใน UI จะ re-render เสร็จเล็กน้อย test ที่จับภาพหรือตรวจ UI ต้องรอ `toHaveValue` ก่อน (spec ของ builder ทำถูกแล้ว)

## สรุป
AC-143 และกฎข้อ 106 (a)–(d) ผ่านทั้ง 375 และ 1280 ข้อความไทยเฉพาะแสดงในการ์ดหรือแถวของ line ที่ถูกต้องและไม่ล้นจอ error อื่นยังได้ข้อความเดิม ไม่พบ regression
