# SFUI-7 — QA evidence (spec 09)

ทดสอบที่ปลาย stack `8559bb29` (feat/SFUI-7-shadcn-pristine บน SFUI-6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1`; Stripe test key จริง (test mode) + `stripe listen` forward webhook แบบเดียวกับ CI
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

- e2e ที่อ้างไฟล์ที่ SFUI-7 แตะ (75 spec, 210 test): ผ่าน 209 / ล้ม 1 (`core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS — ทราบอยู่แล้ว รอ CI บน Linux)
- `sfui-mobile-390` บน DB สะอาด: ผ่าน
- `test:e2e:unit` 203/203 (รวม `sfui-7-ui-pristine`), vitest `button.test.tsx` + `wrappers.test.tsx` 15/15
- ไฟล์ใน `src/components/ui/*` ตรงกับ `pnpm dlx shadcn@4.23.1 add <name> --dry-run --diff` ("No changes." ครบ 14 ไฟล์)
- ชุด Stripe: พบ D-1 (ปุ่ม `submit-payment-button` สูง 40px คลิกหลังกรอกบัตรตกใน iframe) — แก้แล้วด้วยการคืนความสูง 48px ของปุ่ม `large` เดิม (SFUI-2/3c/3d/3e/5c/5d) ผลหลังแก้เท่ากับ develop บนเครื่องเดียวกัน

| AC | Result | Evidence |
|----|--------|----------|
| AC-8 | pass | vitest `src/components/button.test.tsx` ผ่าน; qa2-03-button-loading.png (ปุ่มขึ้น "กำลังดำเนินการ..." และ disabled ระหว่างส่ง) |
| AC-14 | pass | `sfui-4-store` และ `core-store` ผ่าน; qa2-01-price-slider.png (thumb ชื่อ "ราคาต่ำสุด"/"ราคาสูงสุด", กด ArrowRight แล้วค่าเปลี่ยน) |
| AC-17 | pass | `sfui-mobile-390` ผ่านบน DB สะอาด |
| AC-19 | pass | static `sfui-7-ui-pristine` + `wrappers.test.tsx` ผ่าน; qa2-02-side-menu-sheet.png (พื้นหลังดำ 50% z-50, ปุ่มปิด "ปิดเมนู", คลิกพื้นหลังแล้วปิดและ focus กลับปุ่มเปิด); e2e ชุด SFUI 209/210 (core-50 = เครื่อง); ชุด Stripe หลังแก้ D-1 เท่ากับ develop |

Edge case: Escape/คลิกพื้นหลังปิด sheet และคืน focus · ปุ่ม loading ระหว่างส่งเป็น disabled กดซ้ำไม่ได้ · กดซ้ำ 20 รอบ (`core-19b`) ผ่าน
