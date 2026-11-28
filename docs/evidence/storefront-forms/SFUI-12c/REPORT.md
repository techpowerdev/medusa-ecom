# Evidence: SFUI-12c — ฟอร์ม storefront ใช้ field ของ shadcn (spec 09 รอบ 48, ADR-032)

qa ตรวจที่ปลาย stack `ba4c7b2b` (SFUI-11a..13) บน prod build ทั้งสองฝั่ง, Stripe test mode + `stripe listen` ชุด events ตาม CI
e2e ใหม่ของรอบ 17/17 (2 รอบ), e2e เดิมตาม AC-29 + group buy 22/22, Playwright project unit 245/245, vitest 2052, e2e ชุดเต็ม 564 ผ่าน / 4 ล้ม (3 flaky รันซ้ำผ่าน, `core-50-nav-narrow:171` ล้มบน develop `17f49dec` เหมือนกัน — ไม่เกี่ยวกับรอบนี้) / 1 skip (`pay-19` ต้องมี secret)
report/trace เต็มของ Playwright อยู่ใน CI artifact

| AC | Result | Evidence |
|----|--------|----------|
| AC-29 (12c) | pass | sfui-9e 4/4 และขั้น group buy ของ sfui-8 ผ่าน |
| AC-33 | pass | ชุดเต็ม (core-20d, affiliate-portal*) |
| AC-34 | pass | `sfui-12c-feature-forms.spec.ts` 5/5 — 01-return-form-1280.png, 02-group-join-1280.png, 03-affiliate-auth-1280.png |
| AC-36 | pass | เหมือน SFUI-11a |
| regression group buy (Stripe) | pass | `group-buy-account-orders` 6/6 (บัตร + พร้อมเพย์, webhook 200 ×5) |

## ตรวจด้วยตา / edge (นอก AC)
- label เหนือช่อง, `*` สีแดงเฉพาะช่องบังคับ, placeholder เฉพาะเบอร์โทร/รหัสไปรษณีย์, ไม่เหลือ floating label
- กด sign-in สองครั้งตอนช่องว่าง → error ช่องละ 1 ไม่ส่ง action; ปุ่มแสดงรหัสผ่านสลับแล้วค่ายังอยู่; register 320px ไม่ล้นแนวนอน; โค้ดส่วนลดผิดกดสองครั้ง → `promotion-error` 1 อัน
- ข้อสังเกต (ไม่ใช่ defect): ช่องบังคับที่มีแต่ช่องว่างผ่าน `required` ของ native (พฤติกรรมเดิม — นอกขอบเขต); ระยะคู่ช่องในบัญชี ~8px vs checkout ~16px; error ใต้ช่องห่าง label ช่องถัดไป ~8px
- ภาพมีอีเมลทดสอบ `@example.com` เท่านั้น

## Defect
ไม่พบ
