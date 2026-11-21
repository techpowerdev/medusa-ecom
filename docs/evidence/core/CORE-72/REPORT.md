# QA — CORE-72 (PR #455) ตัวเลขตะกร้าใน nav ไม่กระพริบ "(0)" ระหว่างโหลด

Spec: docs/spec/01-core-medusa.md หัวข้อ "Follow-up รอบ 40" กฎข้อ 130 / AC-171
ทดสอบบน commit 05a9b0bd (prod build backend + storefront), Playwright chromium
หน่วง server action และ RSC fetch 2.5 วินาที แล้วเก็บข้อความ + aria-busy ของ `nav-cart-link` ทุก mutation ตั้งแต่ HTML แรก (addInitScript)

| AC | Result | Evidence |
|----|--------|----------|
| AC-171 ลูกค้า 2 ชิ้น `/th`: ระหว่างโหลดเป็น "ตะกร้า" + aria-busy="true" ไม่มี "(0)" แล้วเป็น "(2)" | pass | qa455-01-loading-busy.png |
| AC-171 ลูกค้า 2 ชิ้น `/th/store`: ไม่มี "(0)" ได้ "(2)" | pass | qa455-02-loaded-2.png |
| AC-171 ลูกค้า 2 ชิ้น PDP: "ตะกร้า"(busy) → "(2)" | pass | ผล test |
| AC-171 ตะกร้าว่างจริง → "ตะกร้า (0)" ไม่ busy | pass | qa455-03-empty-0.png |
| AC-171 ไม่ login → "ตะกร้า"(busy) → "ตะกร้า (0)" ไม่ค้าง busy | pass | ผล test |
| AC-171 เพิ่มจาก PDP / ลบใน dropdown → 2 → 3 → 1 ไม่ผ่าน "(0)" | pass | qa455-04-after-add-3.png |
| AC-171 มือถือ 375px: "ตะกร้า (2)" ไม่ล้นจอ ไม่มี "(0)" | pass | qa455-05-mobile-375.png |
| e2e ของ builder `core-72-cart-count-no-flash.spec.ts` (`--repeat-each=2`) | pass 4/4 | CI artifact `e2e-evidence` |

## Negative / edge
| กรณี | ผล |
|------|----|
| ไม่ login แต่มี cookie `_medusa_cart_id` ของคนอื่น | "ตะกร้า (0)" ไม่ busy |
| ดับเบิลคลิก `add-product-button` | ตัวเลขใน nav (3) ตรงกับ backend (3) |
| server action โหลด cart ล้ม (abort) | ป้ายค้าง "ตะกร้า" + aria-busy ไม่เดาเป็น (0) — ตามที่ PR ระบุว่านอกขอบเขต |
