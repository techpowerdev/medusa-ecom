# QA REPORT — CORE-64 (PR #392)

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 33" กฎข้อ 122, AC-163

## Commit ที่ตรวจ
- `52a23c7c` (head ของ `feat/CORE-64-promotion-fixed-tax-inclusive`, base `develop` 4a3f5665)

## สภาพแวดล้อม
- worktree แยกใน scratchpad จาก head ของ PR, node v22.23.3
- prod build ทั้งสองฝั่ง: backend + admin `medusa build` แล้ว `medusa start` (`NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) ที่ port 9311; storefront `next build` แล้ว `next start` ที่ port 8311
- DB `medusa_qa392` สร้างใหม่ แล้ว migrate + seed + admin user ของ seed; Redis db 11; ไม่ใช้ Stripe จริง
- **การหา element**: หน้า promotion ของ dashboard (Medusa core) ไม่มี `data-testid` และเราแก้ไม่ได้ จึงหาด้วย role/label เฉพาะขั้นนี้ (radio "Amount off products", textbox "Code", switch "Does promotion include taxes?", combobox "Select Value" → option "Thai Baht", label "Promotion Value", spinbutton "Maximum Quantity", ปุ่ม Continue/Save, เมนู ⋯ → menuitem "Edit", dialog "Edit Promotion Details"); storefront หาด้วย testid ภายใน `cart-totals` (`cart-discount`, `cart-subtotal`, `cart-subtotal-label`, `cart-shipping`, `cart-total`, `discount-input`, `discount-apply-button`, `add-discount-button`, `promotion-error`)
- ขับ dashboard ด้วย Playwright spec ชั่วคราว (ไม่ commit) ทุกขั้นกรอกผ่าน UI จริง ตรวจค่าด้วย `GET /admin/promotions/:id` และ store API
- สินค้าทดสอบ: seed t-shirt ราคา ฿590 รวม VAT ค่าส่ง Standard ฿10
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #392 (14 วัน)

## ผล AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-163(a) integration | pass (CI) | `CORE-64-tests.txt` ของ builder (red: สลับ true↔false แล้ว 3 เคส fixed ล้ม) และ CI `backend-tests` |
| AC-163(b) e2e storefront | pass | รันซ้ำบน stack นี้ `core-64-promotion-fixed-vat.spec.ts` 1 passed · `01-cart-fixed-100-vat-inclusive.png` (builder) |
| AC-163(c) คู่มือ (unit) | pass | รันซ้ำ `core-64-admin-promotions-guide.unit.spec.ts` 1 passed |
| AC-163(d) สร้างผ่าน dashboard จริง | pass | `qa392-01-form-switch-on.png`, `qa392-02-detail-tax-inclusive-true.png`, `qa392-03-cart-ui-code-discount-100.png` |

## Checklist AC-163(d)

| # | ขั้น | ผล |
|---|------|----|
| 1 | Promotions → "Create" → `/app/promotions/create` → "Amount off products" → Continue | pass |
| 2 | Method = Promotion code (ค่าเริ่มต้น), Code, Status = Draft (ค่าเริ่มต้น), สวิตช์ปิดอยู่ (`aria-checked=false`) แล้วกดเปิด, Currency Code Equals "Thai Baht", Promotion Value = 100, Maximum Quantity = 1 → Continue → Save | pass (`qa392-01`) |
| 3 | `GET /admin/promotions/:id`: `is_tax_inclusive: true`, `draft`, fixed / items / each, 100, thb, max_quantity 1; หน้า detail "Tax Inclusive" = True | pass (`qa392-02`) |
| 4 | ⋯ → Edit → Status Active → Save → API `active` และ `is_tax_inclusive` ยัง true | pass |
| 5 | ลูกค้า login ใส่โค้ดผ่าน UI ที่ `/th/cart` | pass (`qa392-03`) |
| 6 | control: โปรแบบเดียวกันแต่ไม่เปิดสวิตช์ | pass — ยืนยันปัญหาจริง |
| 7 | "Amount off order" + เปิดสวิตช์ และ "Percentage off product" 10% | pass |
| 8 | ทำตามคู่มือทีละขั้น | ทำได้ครบทุกขั้น มี nit ถ้อยคำ 3 จุด (N-1) |
| 9 | ป้าย "ยอดรวมสินค้าก่อนส่วนลด (รวม VAT)" (CORE-62) | pass ทุกเคสส่วนลดสินค้า |

ตัวเลขในตะกร้าของข้อ 5–7:

| เคส | `cart-subtotal` | `cart-discount` | `cart-shipping` | `cart-total` | `discount_total` (API) | อื่น ๆ |
|-----|-----------------|-----------------|-----------------|--------------|------------------------|--------|
| A fixed เปิดสวิตช์ | 590 | **100** | 10 | 500 | 100 | total ก่อนใส่โค้ด 600 → 500, แถว "รวม VAT แล้ว" ฿32.71 |
| B control ไม่เปิดสวิตช์ | 590 | **107** | 10 | 493 | 107 | detail "Tax Inclusive" = False |
| C Amount off order เปิดสวิตช์ | 590 | **100** | 10 | 500 | 100 | target `order`, allocation `across`, ไม่มีช่อง Maximum Quantity |
| D Percentage off product 10% | 590 | **59** | 10 | 541 | 59 | ไม่มีสวิตช์ในฟอร์ม, `is_tax_inclusive: false` |

ทุกเคส `subtotal − discount + shipping = total` (±0.01)

## Negative / edge case

| เคส | ผล |
|-----|----|
| ใส่โค้ดขณะโปรยังเป็น Draft | `promotion-error` "ใช้โค้ดนี้ไม่ได้ โค้ดอาจหมดอายุหรือไม่ตรงเงื่อนไขของตะกร้า" ไม่มีแถวส่วนลด — ถูกต้อง |
| qty 2 แต่ Maximum Quantity = 1 | `discount_total` = 100 (ลดชิ้นเดียว) — ถูกต้อง |
| dblclick `discount-apply-button` | ส่วนลด 100 ไม่ซ้อน, promotions 1, `discount-row` 1 แถว — ถูกต้อง |
| ลืมเปิดสวิตช์แล้วแก้ตามคู่มือ (โปร B) | Edit → เปิดสวิตช์ → Save ได้ `is_tax_inclusive: true` ลบโค้ดแล้วใส่ใหม่ ส่วนลด 107 → **100** — คู่มือใช้ได้จริง |
| Edit เปลี่ยน Value Type เป็น "Percentage" | สวิตช์หายทันที บันทึกได้ `percentage` + `is_tax_inclusive: false` — ตรงหมายเหตุในคู่มือ |
| campaign หมดอายุ | store API 200 แต่ไม่ใส่โปร (`discount_total` 0) — ตามพฤติกรรม Medusa |

## Defect
ไม่มี — `discount_total` ของ fixed ที่ `is_tax_inclusive: true` = 100.00 พอดีทั้ง items/each และ order/across (ไม่เข้าเงื่อนไขหยุดของกฎข้อ 122d)

## ข้อสังเกต (ไม่บล็อก)
- **N-1 (nit คู่มือ `docs/guides/admin-promotions.md`)** ข้อความต่างจากหน้าจอ 3 จุด แต่ทำตามได้: ข้อ 3 "เลือกสกุลเงิน THB" แต่ dropdown แสดง **"Thai Baht"**; ข้อ 4 "แท็บ Campaign (ถ้ามี)" แต่แท็บมีเสมอ ต้องกด **Continue** ที่แท็บ Details ก่อนจึงเห็นปุ่ม Save (ค่าเริ่มต้น "Without Campaign"); หมายเหตุฟอร์ม Edit "Value Type เป็น Amount" แต่ label จริงคือ **"Fixed amount"** / "Percentage"
- **N-2** หน้า detail ของโปร percentage ไม่มีแถว "Tax Inclusive" (dashboard ซ่อน) ไม่ขัดคู่มือ
- **N-3** template percentage ไม่มีเงื่อนไข Currency Code และช่อง Promotion Value เป็น spinbutton (fixed เป็น textbox) — พฤติกรรมของ dashboard
