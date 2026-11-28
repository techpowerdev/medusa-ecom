# Evidence: SFUI-11a — ฟอร์ม storefront ใช้ field ของ shadcn (spec 09 รอบ 48, ADR-032)

qa ตรวจที่ปลาย stack `ba4c7b2b` (SFUI-11a..13) บน prod build ทั้งสองฝั่ง, Stripe test mode + `stripe listen` ชุด events ตาม CI
e2e ใหม่ของรอบ 17/17 (2 รอบ), e2e เดิมตาม AC-29 + group buy 22/22, Playwright project unit 245/245, vitest 2052, e2e ชุดเต็ม 564 ผ่าน / 4 ล้ม (3 flaky รันซ้ำผ่าน, `core-50-nav-narrow:171` ล้มบน develop `17f49dec` เหมือนกัน — ไม่เกี่ยวกับรอบนี้) / 1 skip (`pay-19` ต้องมี secret)
report/trace เต็มของ Playwright อยู่ใน CI artifact

| AC | Result | Evidence |
|----|--------|----------|
| AC-26 | pass | `sfui-11-form-field.unit` 6/6 (a–e) |
| AC-27 | pass | vitest `input.test.tsx` (25/25 รวม field-validation) |
| AC-28 | pass | `sfui-11-form-field.spec.ts` 2/2 — 01-login-1280.png, 02-checkout-address-1280.png, 03-checkout-address-390.png, 04-register-375.png |
| AC-29 | pass | sfui-8 1, sfui-5a 2, core-38 5, core-4e 1, sfui-9a 3; `sfui-8-floating-label.unit` 3/3; e2e ที่แก้มีเฉพาะไฟล์ตามรายการ |
| AC-36 | pass | diff ของ backend/package.json/lockfile/globals.css ว่าง; `ui/` มีเฉพาะไฟล์ใหม่จาก CLI (field, input-group, separator, textarea); shadcn unit 8/8 |

## ตรวจด้วยตา / edge (นอก AC)
- label เหนือช่อง, `*` สีแดงเฉพาะช่องบังคับ, placeholder เฉพาะเบอร์โทร/รหัสไปรษณีย์, ไม่เหลือ floating label
- กด sign-in สองครั้งตอนช่องว่าง → error ช่องละ 1 ไม่ส่ง action; ปุ่มแสดงรหัสผ่านสลับแล้วค่ายังอยู่; register 320px ไม่ล้นแนวนอน; โค้ดส่วนลดผิดกดสองครั้ง → `promotion-error` 1 อัน
- ข้อสังเกต (ไม่ใช่ defect): ช่องบังคับที่มีแต่ช่องว่างผ่าน `required` ของ native (พฤติกรรมเดิม — นอกขอบเขต); ระยะคู่ช่องในบัญชี ~8px vs checkout ~16px; error ใต้ช่องห่าง label ช่องถัดไป ~8px
- ภาพมีอีเมลทดสอบ `@example.com` เท่านั้น

## Defect
ไม่พบ
