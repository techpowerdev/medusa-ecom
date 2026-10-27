# QA FS-6 — storefront flash sale (PR #115)

- Spec: `docs/spec/03-flash-sale.md` (แถว FS-6, AC-1, AC-4, AC-8 g, AC-13 e, กฎข้อ 4), ADR-009, ADR-014
- Commit ที่ตรวจ: `1b2ca97` (branch `feat/FS-6-storefront-flash-ui`)
- สภาพแวดล้อม: backend `medusa build` + `medusa start`, storefront `next build` + `next start`, Node 22, ใช้ `pp_system_default` (ไม่ใช้ Stripe)
- e2e ของ PR: `apps/storefront/e2e/flash-sale-storefront.spec.ts` (`E2E_SAVE_EVIDENCE=1`) → ผ่าน 4/4
- e2e ของ qa (ในเครื่อง ไม่ได้ commit): ผ่าน 6/6
- Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (เก็บ 14 วัน)

## ผลตาม acceptance criteria

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-1 cart แสดงยอดหลังส่วนลด flash (−20% → ฿800) | ผ่าน | 03-cart-flash-discount.png |
| AC-1 หลัง `ends_at` cart ใหม่ราคาเต็ม | ผ่าน | test "AC-1: หลัง ends_at…" (`cart-total`=1000, ไม่มี `cart-discount`) |
| AC-4 PDP countdown + ราคาขีดฆ่าที่ T−1min | ผ่าน | 01-pdp-flash-t-minus-1min.png |
| AC-4 กล่อง flash หายที่ T+1min | ผ่าน | 02-pdp-flash-t-plus-1min.png |
| AC-8 (g) code + สินค้า flash → `flash-not-combinable` ภาษาไทย | ผ่าน | 04-cart-code-not-combinable.png (ยอดของ code ฿900; ลบ code → ข้อความหาย ฿800) |
| AC-13 (e) `sold_out=true` → `flash-sold-out` ภาษาไทย | ผ่าน | 05-pdp-flash-sold-out.png |
| กฎข้อ 4 "เหลือ N ชิ้น" จาก `remaining_units` | ผ่าน | 01 ("เหลือ 10 ชิ้น" = total_cap) |

## Checklist ของ qa

| รายการ | ผล | หลักฐาน |
|--------|----|---------|
| กล่อง flash เป็นภาษาไทย, countdown เดินทุกวินาที | ผ่าน | QA-TICK [1797, 1795, 1794, 1793], expectThai |
| T+1min กล่องหาย เหลือ `product-price` | ผ่าน | 02 |
| `sold_out` → `flash-sold-out` ไม่มี `flash-price` | ผ่าน | 05 |
| ใส่ code → ข้อความขึ้น, ลบ code → ข้อความหาย | ผ่าน | QA-CODE |
| variant นอกแคมเปญ / ไม่มีแคมเปญ ไม่มีกล่อง และไม่มี hydration error | ผ่าน | QA-VARIANT (console error `[]`) |
| มือถือ (320/375px) กล่องไม่ล้นจอ | ผ่าน | QA-MOBILE (scrollWidth = ความกว้าง viewport) |

## ราคา PDP เทียบกับ cart

| target rule | preview `flash_price` | `cart.total` | ตรงกัน |
|-------------|----------------------|--------------|--------|
| items.product.id | 800 | 800 | ใช่ |
| items.product_id | 800 | 800 | ใช่ |
| items.variant_id | 800 | 800 | ใช่ |
| items.product.collection_id | 800 | 800 | ใช่ |
| items.product.categories.id | 800 | 800 | ใช่ |
| fixed ฿100 (ไม่รวมภาษี) | 893 | 893 | ใช่ |
| items.product.id จำนวน 2 | 2×800 | 1600 | ใช่ |

ไม่พบความไม่ตรงกัน

## Negative / edge case

| กรณี | ผล |
|------|----|
| แคมเปญหมดอายุ | cart ราคาเต็ม และ PDP ไม่มีกล่อง (ตามคาด) |
| แคมเปญยังไม่เริ่ม | PDP ไม่มีกล่อง (ตามคาด) |
| กด apply code สองครั้ง | มี `discount-row` เดียว (ตามคาด) |
| total_cap=1 สั่ง 2 ชิ้น | cart แสดง ฿1,600 แต่ complete ได้ 409 FLASH_SOLD_OUT (ข้อความอังกฤษ) — O-1 |
| sold_out แล้วกดเพิ่มลงตะกร้า | ยังกดได้ และขึ้น "มีสินค้า" — O-2 |
| webhook replay | ไม่เกี่ยวกับ FS-6 |

## ข้อสังเกต (ไม่ block)
- O-1 จำนวนเกิน `remaining_units`: ตะกร้าแสดงราคา flash แต่ complete ล้มด้วย FLASH_SOLD_OUT ข้อความอังกฤษ ทั้งที่ยังเหลือ 1 ชิ้น
- O-2 เมื่อ sold_out: PDP ขึ้น "สินค้าหมด" แต่ยังมี "มีสินค้า" และปุ่มเพิ่มลงตะกร้ายังกดได้ (task FS-13)
- O-3 แถบ sticky บนมือถือ และ `product-price` ด้านบนกล่อง แสดง ฿1,000 แบบไม่ขีดฆ่า
