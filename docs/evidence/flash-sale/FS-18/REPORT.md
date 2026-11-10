# Evidence: FS-18 — `revalidate` ใน `lib/data`, e2e ลบข้อมูลครบ, `/store` ไม่ยิงข้อมูล flash ชุดเก่า (QA PR #216)

- Spec: `docs/spec/03-flash-sale.md` — AC-25 (รวมส่วนขยายรอบ 13), กฎข้อ 23
- PR: #216 — branch `fix/FS-18-revalidate-e2e-cleanup` @4dae597
- สภาพแวดล้อม: backend `medusa develop`, storefront prod build (`next build && next start`), node 24.12.0; ลูกค้า login; ไม่ใช้ Stripe (`pp_system_default`); หา element ด้วย `data-testid`
- ผล: e2e fs14 + fs16 สองรอบ 8/8 ทั้งสองรอบ; vitest ของ task 24/24; spec ของ qa QA-1..4 + EDGE-1..3 ผ่าน
- รายงาน/trace ฉบับเต็ม: CI artifact ของ PR #216 (14 วัน)

## ผลตาม AC

| AC / หัวข้อ | ผล | หลักฐาน |
|---|---|---|
| AC-25 unit + static (`next.revalidate` ≤ 60, ไม่มี `force-cache` ไร้ `revalidate` ยกเว้นที่ระบุเหตุผล) | pass | vitest 24 (`catalog-revalidate.test.ts`, `fs-18-e2e-cleanup.test.ts`) |
| AC-25 e2e ลบข้อมูลครบ: สินค้า/collection/แคมเปญ/โปรโมชันของ run หมด, footer 375px ไม่มี `FS-14`/`FS-16`, หน้ากว้าง 375px | pass | `qa1-footer-375.png` |
| AC-25 e2e `/store` (login) ค้น X → คำที่ไม่พบ → Y: request flash 1 ครั้ง เฉพาะ variant ของ Y, ไม่มีราคา flash เก่าค้าง | pass | `qa2-store-search-y.png` |
| กฎ 23a แก้ category/collection/region ใน admin → ขึ้นบน storefront prod ภายใน ~90 วินาที | pass (42–63 วินาที) | `qa3-category-renamed.png` |
| ความเสี่ยงจาก cache 60s: ราคา/สต็อก/วิธีชำระ (บันทึกผลจริง) | ตามที่ออกแบบ (≈ 60–64 วินาที) backend กันได้ | `qa4-checkout-oos-blocked.png`, `edge1-add-oos-stale-pdp.png` |

## รายละเอียดผลวัด
- **ข้อมูลค้างหลัง fs14/fs16:** products 2 (t-shirt, sweatshirt), collections 1 (featured), campaigns 0, promotions 0; collection `FS-14 …`/`FS-16 …` ถูก soft-delete
- **footer:** `/th` สะอาดภายใน 48 วินาทีหลัง fs16 จบ, `/th/store` ทันที; `scrollWidth` 375 ทั้งสองหน้า
- **`/store`:** หน่วง request flash 3 วินาที — ระหว่างรอไม่มี `flash-price` ขึ้น (MutationObserver ไม่จับได้เลย); การ์ด X ฿800 + ฿1,000 ขีดฆ่า, การ์ด Y ฿1,000 ไม่มี flash; ค้น X ซ้ำ → ระหว่างรอใช้ราคาจาก index ก่อนแล้วจึง ฿800 ยิง 1 ครั้ง
- **เวลาที่ขึ้น (23a):** หัวข้อหน้า category 48s, `footer-categories` 44s, หัวข้อหน้า collection 63s, collection ใน footer 42s, เพิ่มประเทศใน region (ดูจาก `llms.txt`) 42s
- **ความเสี่ยงจาก cache:**
  - ราคา 1000 → 1500: PDP แสดง ฿1,000 อยู่ 64 วินาที กดเพิ่มช่วงนั้น cart ได้ `unit_price` 1500 (backend คิดราคาใหม่)
  - สต็อกเป็น 0: PDP แสดง "มีสินค้า" 61 วินาที กดเพิ่ม → `add-to-cart-error` ข้อความไทย cart 0 รายการ; cart ที่ใส่ไว้ก่อนหมดกด `submit-order-button` → `manual-payment-error-message` ไม่มี order เกิด
  - ถอด `pp_system_default` จาก region: checkout แสดงตัวเลือกอยู่ 62 วินาที — API ได้ 400 "not enabled in the cart's region"; UI ได้ `payment-method-error-message` ค้างที่ขั้น payment

## Negative / edge
- พิมพ์ค้น X แล้วเปลี่ยนเป็น Z ทันที → request flash 1 ครั้ง เฉพาะ variant ของ Z
- ล้างคำค้น → ยิง 1 ครั้ง (สินค้าทั้งร้าน)
- ค้นที่ได้ hit ชุดเดิม (เติมช่องว่าง) → ยิง 0 ครั้ง

Defect ของ PR: ไม่พบ

## ข้อสังเกต (ไม่บล็อก PR)
1. **O-1 (นอก FS-18):** collection ชื่อยาวไม่มีช่องว่าง (เช่น `QA216-LONG-<26 หลัก>`) ทำให้ footer 375px กว้าง 401px — footer ไม่ตัดคำ (`break-words`/`min-w-0`)
2. **O-2:** สั่งซื้อของที่หมดได้ข้อความทั่วไป "ยืนยันคำสั่งซื้อไม่สำเร็จ…" ไม่บอกว่าสินค้าหมด
3. **O-3 (ความเสี่ยงที่ยอมรับตาม ADR-017):** ช่วง ≤ ~64 วินาที PDP/checkout แสดงราคา สต็อก วิธีชำระแบบเก่าได้ — backend กันได้ทุกกรณี ยกเว้นราคาที่ cart คิดราคาใหม่โดยไม่แจ้งลูกค้า
