# SFUI-8 — QA evidence (spec 09 กฎ 23)

ทดสอบรวมทั้ง stack รอบ 45 ที่ปลาย `c43e5764` (SFUI-10 ซึ่งรวม 8 + 9a..9e) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่, Stripe test mode + `stripe listen`
e2e chromium `--workers=1` ทั้งชุด = 534 ผ่าน / 5 ล้ม / 1 ข้าม — ล้มทั้งหมดไม่ใช่ของรอบ 45: `core-50-nav-narrow` 1280 (ความกว้างต่าง 1.27px บน macOS, ทราบอยู่แล้ว)
และ 4 ตัวที่ค้าง `step=payment` หลังกดปุ่มไปขั้น review ด้วยบัตร (flake เดิม; รันซ้ำเดี่ยวผ่านทั้งหมด และ `payments` AC-3 ล้มสลับผ่านบน commit ฐาน `e2a3ffa9` ด้วย);
ข้าม 1 = `pay-19` (ไม่ตั้ง `E2E_PROMPTPAY_REFUND_EMAIL`) · `test:e2e:unit` 212/212 · vitest 132 ไฟล์ 2022/2022
เทียบกับ commit ฐาน `e2a3ffa9` (build แยกที่ :8191 บน backend/DB เดียวกัน): อ่าน `fontSize/lineHeight/fontWeight` ของทุก element ที่มีข้อความใน 21 หน้า × 390/1280
และ screenshot ทั้งหน้า — ตรงกันทุกหน้า (screenshot เหมือนกันระดับ byte) ยกเว้นป้ายตัวเลือก/จำนวนบน PDP และ `/g/<token>` ที่ SFUI-8 ตั้งใจแก้
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-22 | pass | `sfui-8-floating-label.unit.spec.ts` ใน `test:e2e:unit` 212/212; `globals.css` ไม่มี selector `~ label`/`+ label` แล้ว |
| AC-23 (1) | pass | `sfui-8-floating-label.spec.ts` ข้อ (1) ผ่านทั้งหลังแก้และบน commit ฐาน; วัดเองที่ 390/1280 ใน login, register, affiliate login, checkout ที่อยู่, profile, เพิ่มที่อยู่: ว่าง 14px/20px/400 `translate: none`; focus 10px/16px/400 `0px -12px` `left: 0px` 0.3s; กรอกแล้ว blur 10px/16px ไม่มี transition; ค่าที่เติมจากโค้ดลอยทันที (0s) — ทุกค่าเท่ากับ commit ฐาน; 04-register-floating-label-390.png, 05-checkout-address-floating-label-1280.png |
| AC-23 (2) | pass | ข้อ (2)(3) ผ่านหลังแก้และ **ล้มบน commit ฐาน** (`option-button "S"` 10px/16px ตามที่คาด); PDP 390: option-button S/M/L 12px/20px/400 `translate: none` top 852 ≥ legend bottom 840 (เดิม 10px/16px เลื่อน -12px ชิด legend), label จำนวน 12px/20px/400 (เดิม 10px/16px เลื่อน -12px); 01-pdp-options-before-390.png, 02-pdp-options-after-390.png |
| AC-23 (3) | pass | หน้า `/g/<token>` option-button 12px/20px/400 ไม่เลื่อน ไม่ทับ legend (390 และ 1280); label อื่นใน checkout ที่อยู่/ชำระเงิน (checkbox, radio) ไม่เปลี่ยน — font และ screenshot เท่ากับ commit ฐานระดับ byte; 03-group-options-after-1280.png |
| AC-23 (กฎ 25) | pass | `core-38-mobile-layout`, `sfui-5a-common`, `core-4e-checkout-polish`, `core-24-pdp-quantity`, `core-25-pdp-option-reset`, `core-14b-add-variant`, `fs-21-customer-limit`, `fs-23-pdp-cart-aware-limit`, `flash-sale-fs15`, `group-buy-join`, `group-buy-ui-polish` ผ่านในชุดเต็ม |
| AC-25 | pass | `git diff b2b27ccc c43e5764 --stat -- apps/backend apps/storefront/src/components/ui apps/storefront/package.json pnpm-lock.yaml` ว่าง |

edge case: ล้างค่าที่เติมไว้แล้ว blur → กลับเป็นป้ายปกติ 14px/20px ไม่เลื่อน (เท่าฐาน); ช่องรหัสผ่าน (มีปุ่มแสดง/ซ่อน) ลอยถูกต้อง; ป้ายใน modal เพิ่มที่อยู่ลอยถูกต้อง
