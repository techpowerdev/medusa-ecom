# Evidence: SFUI-13 — ฟอร์ม storefront ใช้ field ของ shadcn (spec 09 รอบ 48, ADR-032)

qa ตรวจที่ปลาย stack `ba4c7b2b` (SFUI-11a..13) บน prod build ทั้งสองฝั่ง, Stripe test mode + `stripe listen` ชุด events ตาม CI
e2e ใหม่ของรอบ 17/17 (2 รอบ), e2e เดิมตาม AC-29 + group buy 22/22, Playwright project unit 245/245, vitest 2052, e2e ชุดเต็ม 564 ผ่าน / 4 ล้ม (3 flaky รันซ้ำผ่าน, `core-50-nav-narrow:171` ล้มบน develop `17f49dec` เหมือนกัน — ไม่เกี่ยวกับรอบนี้) / 1 skip (`pay-19` ต้องมี secret)
report/trace เต็มของ Playwright อยู่ใน CI artifact

| AC | Result | Evidence |
|----|--------|----------|
| AC-35 | pass | `sfui-13-form-guard.unit.spec.ts` 3 test ของ AC-35 |
| AC-36 | pass | เหมือน SFUI-11a |
| AC-37 (static) | pass | `sfui-13-form-guard.unit.spec.ts` AC-37(3) + profile-password (static) |

## ตรวจด้วยตา / edge (นอก AC)
- label เหนือช่อง, `*` สีแดงเฉพาะช่องบังคับ, placeholder เฉพาะเบอร์โทร/รหัสไปรษณีย์, ไม่เหลือ floating label
- กด sign-in สองครั้งตอนช่องว่าง → error ช่องละ 1 ไม่ส่ง action; ปุ่มแสดงรหัสผ่านสลับแล้วค่ายังอยู่; register 320px ไม่ล้นแนวนอน; โค้ดส่วนลดผิดกดสองครั้ง → `promotion-error` 1 อัน
- ข้อสังเกต (ไม่ใช่ defect): ช่องบังคับที่มีแต่ช่องว่างผ่าน `required` ของ native (พฤติกรรมเดิม — นอกขอบเขต); ระยะคู่ช่องในบัญชี ~8px vs checkout ~16px; error ใต้ช่องห่าง label ช่องถัดไป ~8px
- ภาพมีอีเมลทดสอบ `@example.com` เท่านั้น

## Defect
ไม่พบ
