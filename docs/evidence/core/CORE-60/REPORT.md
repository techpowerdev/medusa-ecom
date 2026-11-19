# QA — PR #372 CORE-60 ป้ายแถวแรกของ cart-totals เมื่อมีส่วนลด

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 31" กฎข้อ 118, AC-159 (+ regression AC-156, AC-117)
commit ที่ตรวจ: `9375fcbf` (`origin/feat/CORE-60-cart-subtotal-label`, base develop `ff502ff1`) — 2026-11-14

## สภาพแวดล้อม
- worktree แยกของ qa, node v22.23.3
- prod build ทั้งสองฝั่ง: backend `medusa build` + `medusa start` ที่ :9312, storefront `next build` + `next start` ที่ :8312
- DB `medusa_qa372` (สร้างใหม่ → migrate → seed), Redis db 12
- ไม่ใช้ Stripe จริง: ใช้ `pp_system_default` และ key ปลอมแบบ CI (`sk_test_dummy`), `ALLOW_TEST_PROVIDERS=true`
- หา element ด้วย `getByTestId("cart-totals").getByTestId(...)` และตรวจภาษาไทยด้วย `THAI` + `latinWordsOutsideAllowList`
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #372 (14 วัน)

## ผล test
| ชุด | ผล |
|---|---|
| Vitest `core-57-cart-totals.test.ts` + `ev-7d-digital-only-totals.test.ts` | 43/43 ผ่าน |
| TDD: Vitest เมื่อใช้ `cart-totals` ของ develop | ล้ม 5 เคส ตามที่คาด (ไม่มี `cart-subtotal-label`) |
| e2e `core-60-cart-subtotal-label.spec.ts` | 1/1 ผ่าน |
| regression e2e `core-57` (AC-156), `core-26` (AC-117 ×2), `ev-7d` (AC-42 ×2), `thai-ui-cart-order` (AC-48/78 ×2) | 7/7 ผ่าน |
| edge spec ของ qa (ไม่ commit) | 6/6 ผ่าน |
| eslint ไฟล์ที่ PR แก้ | ไม่มี error |
| Playwright project `unit` (กฎ evidence) | 108/108 ผ่าน |

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-159 (a) ไม่มีส่วนลด → ป้าย "ยอดรวมสินค้า (รวม VAT)" ไม่มีแถว `cart-discount` | pass | `01-cart-no-discount-label.png` |
| AC-159 (b) ใส่โค้ด → ป้าย "ยอดรวมสินค้าก่อนส่วนลด (รวม VAT)", `cart-subtotal` = `original_item_total`, ยอดสินค้า − ส่วนลด + ค่าจัดส่ง = ยอดรวมทั้งสิ้น = `total` ของ API | pass | `02-cart-discount-label.png` |
| AC-159 (c) ขั้น review ใช้ป้ายเดียวกับ /cart | pass | `03-review-discount-label.png` |
| AC-159 (d) 375×812 ไม่ล้นจอ จำนวนเงินอยู่บรรทัดเดียวและไม่ทับป้าย | pass | `04-cart-discount-label-375.png` |
| กฎข้อ 118 — หน้า order-completed ใช้ป้ายเดียวกัน แถวตรงกับ order ของ admin API | pass | `05-qa-order-confirmed-discount-label.png` |
| AC-156 regression (ค่าจัดส่ง = ราคา option, แถวรวมได้ยอดสุทธิ) | pass | ผล e2e/Vitest ข้างบน |
| AC-117 regression (dropdown = `item_total` ป้ายเดิม, flash) | pass | ผล e2e ข้างบน |

## edge/negative (spec ของ qa ไม่ commit)
| เคส | ผล |
|---|---|
| QA-1 ใส่โค้ดผ่าน UI แล้วกดใช้สองครั้งติดกัน | pass — `discount-row` 1 แถว, cart มี promotion 1 ตัว, ป้ายเปลี่ยน, `cart-subtotal` เท่าก่อนใส่โค้ด (590) |
| QA-1 dropdown ตะกร้าบน nav ตอนมีส่วนลด | pass — ป้ายยังเป็น "ยอดรวมสินค้า (รวม VAT)", ค่า = `item_total` (531) |
| QA-1 ความกว้าง 375 และ 320px | pass — ที่ 320: scrollWidth 320, ป้าย x 24–229, จำนวนเงิน x 264–296 บรรทัดเดียว ไม่ซ้อนกัน |
| QA-1 ลบโค้ดด้วย `remove-discount-button` | pass — ป้ายกลับเป็นแบบเดิม แถวส่วนลดหายไป ยอดรวมตรง API |
| QA-1 checkout จนถึง order-completed | pass — ป้ายแบบก่อนส่วนลด; 590 − 59 + 10 = 541 = `order.total` |
| QA-2 ส่วนลดค่าส่งอย่างเดียว (shipping 100%) | pass — discount 10, ป้ายแบบก่อนส่วนลด, 590 − 10 + 10 = 590 = API |
| QA-3 ส่วนลด 100% ทั้ง order | pass — 590 − 590 + 10 = 10 = API, ที่ 320px ไม่ล้นจอ |
| QA-4 flash sale −20% แบบ automatic (qty 2) | pass — cart-totals: ป้ายแบบก่อนส่วนลด 5900 − 1180 + 10 = 4730 = API; dropdown: ป้ายเดิม 4720 = `item_total` |
| QA-5 cart digital-only (e-voucher) | pass — ไม่มีส่วนลด → ป้ายเดิม; ใส่โค้ด → ป้ายแบบก่อนส่วนลด ไม่มีแถว `cart-shipping` ยอดรวมตรง API |
| QA-6 โค้ดของแคมเปญที่หมดอายุแล้ว | pass — ขึ้น `promotion-error` ภาษาไทย, `discount_total` = 0, ป้ายคงเดิม |
| `expectThai` / คำละติน | pass — ป้ายทุกแบบมีอักษรไทย คำละตินมีแค่ "VAT" |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก PR นี้)
1. ส่วนลดค่าส่งอย่างเดียว (QA-2): ป้ายขึ้นว่า "ก่อนส่วนลด" แม้ตัวสินค้าไม่ได้ลดราคา ตรงตาม spec (AC-159 ใช้ fixture `discount_total: 10`) ถ้อยคำอาจทำให้ลูกค้างงเล็กน้อย — ให้ owner ตัดสินถ้าต้องการปรับ
2. ส่วนลด 100% (QA-3): `total` จาก API = `10.000000000000005` (float จาก Medusa) อยู่ใน `data-value` ของ `cart-total` แต่หน้าจอแสดง ฿10 ถูกต้อง ไม่ใช่เรื่องของ PR นี้
3. หน้า order-completed: แถวสินค้าแสดงราคาซ้ำสองชุด (฿590/฿531 สองครั้ง ดูรูปที่ 05) เป็นของเดิม อยู่นอก scope ของ CORE-60 — ใส่ backlog
4. `docs/evidence/core/CORE-60-tests.txt` ของ builder อยู่ระดับ feature ตาม convention `<TASK-ID>-tests.txt`
