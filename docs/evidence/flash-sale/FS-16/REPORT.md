# รายงาน QA — FS-16 (PR #190)

- Spec: `docs/spec/03-flash-sale.md` กฎข้อ 21, AC-23 (+ regression AC-19..22)
- Commit ที่ตรวจ: `b0bd6da` บน prod build (`medusa start` จาก `.medusa/server` และ `next build` แล้ว `next start`) โดยใช้ DB/Redis แยกของ qa และ Stripe key ปลอม
- CI run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40618782938 (storefront-e2e และ lint-typecheck = success)
  Playwright report และ trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` (เก็บ 14 วัน)

## Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-23 (a) route flash หน่วง 3 วินาที (สินค้า sold out) → ระหว่างรอมี `aria-busy="true"` และ disabled; หลังตอบยัง disabled เพราะ sold out และไม่ busy | pass | e2e `flash-sale-fs16` เคสที่ 3 ผ่าน; qa ยืนยันบน Slow 3G (CDP): สถานะปุ่มเป็นลำดับ `ปกติ → disabled+busy → disabled ไม่ busy` |
| AC-23 (a) route flash ตอบ 500 → ปุ่มกดได้ภายใน 5 วินาที | pass | e2e `flash-sale-fs16` เคสที่ 2 ผ่าน; qa ลองตัด request ทิ้ง (network error) แล้วปุ่มกดได้ภายใน 5 วินาทีเช่นกัน |
| AC-23 (b) แคมเปญไม่ sold out → `text-decoration-line` ของ `product-price` เป็น `line-through` | pass | 01-pdp-product-price-struck.png (desktop, builder), qa-01-pdp-375-price-struck.png (375×812); ไม่มี ฿1,000 แบบไม่ขีดฆ่าบน PDP รวมแถบล่างบนมือถือ |
| AC-23 (c) แคมเปญ sold out → การ์ดบน collection มี `flash-card-sold-out` เป็นอักษรไทยพร้อมราคาปกติ | pass | 02-collection-card-sold-out.png (builder); qa ตรวจ desktop และ 375 แล้วป้ายอยู่ในกรอบการ์ด |
| กฎ 21c บน `/store`, `/search` และ rail หน้าแรก (checklist ของ qa) | pass | qa-02-store-375-card-sold-out.png, qa-03-home-rail-375-card-sold-out.png; `/search` ผ่าน test เดียวกัน |
| Regression AC-19 (FS-13), AC-20 (FS-14 รวม rail หน้าแรก), AC-21/22 (FS-15), AC-1/4/8/13 (FS-6) | pass | e2e flash-sale-fs13/14/15 และ flash-sale-storefront ผ่าน 14/14 |
| Regression no-JS / quantity (CORE-14b/14d/14f, CORE-24) | pass | e2e ผ่าน 15/15 |

## Checklist ของ qa และ edge case

| กรณี | Result | หมายเหตุ |
|------|--------|----------|
| PDP desktop และ 375×812: ราคาขีดฆ่าสีจาง, กล่อง flash ฿800 + ฿1,000 ขีดฆ่า, ไม่มีราคาเต็มซ้ำ | pass | ตรวจทุก text node ที่มี 1,000 นอกการ์ดสินค้าที่เกี่ยวข้อง ทุกจุดถูกขีดฆ่า |
| Slow 3G (ไม่ sold out): รอแล้วกดได้ | pass | ลำดับสถานะ (disabled, aria-busy): `false/false → true/true → false/false` |
| Slow 3G (sold out): รอแล้ว disabled | pass | ลำดับ: `false/false → true/true → true/false` |
| HTML ฝั่ง server ไม่อยู่สถานะรอ | pass | `aria-busy="false"` และไม่มี `disabled` |
| ปิด JavaScript: ปุ่มกดได้ | pass | submit แล้วไปหน้า `/th/account?add_variant=…` |
| กดซ้ำและดับเบิลคลิกระหว่างรอ | pass | ไม่มีการนำทางหรือเพิ่มลงตะกร้า และปุ่มกลับมากดได้หลังได้ข้อมูล |
| แคมเปญ sold out ที่เลย `ends_at` แล้ว | pass | การ์ดไม่มีป้าย และ PDP ไม่ขีดฆ่าหรือรอค้าง |
| สินค้านอกแคมเปญ | pass | ไม่มีป้าย ไม่ขีดฆ่า ไม่มีกล่อง flash |
| ป้ายไม่ล้นการ์ดที่ 375 บน collection, `/store`, `/search` และหน้าแรก | pass | วัดขอบด้วย bounding box |

## Defect

ไม่พบ

## ข้อสังเกต (ไม่ block)

- O-1: `flash-sale-fs16.spec.ts` ไม่ลบสินค้าและ collection ใน `afterAll` (FS-14 ลบตามกติกาของ FS-17) ทำให้ collection `FS-16 <timestamp>` ค้างในลิงก์ footer ชื่อยาวตัดคำไม่ได้จึงดันหน้า `/th/store` และ PDP ที่ 375px ให้กว้าง 380px ตัวป้ายและการ์ดไม่เกี่ยว เสนอให้เพิ่มการลบข้อมูลเป็นงานเล็ก
- O-2: ที่ 375px ป้าย "แฟลชเซลหมดแล้ว" ขึ้นสองบรรทัดคู่กับราคา ยังอยู่ในกรอบการ์ด เป็นเรื่องความสวยงามเท่านั้น
- defect เดิม CORE-25 (เปลี่ยนไซซ์ S→M แล้ว reset): ไม่พบในรอบนี้ เพราะสินค้าทดสอบมี variant เดียว
- แถบล่างบนมือถือ (`mobile-cart-button`) ยังไม่รอข้อมูล flash ตามที่ PR ระบุว่าอยู่นอกขอบเขต
