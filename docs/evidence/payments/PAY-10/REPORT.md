# QA PAY-10 (PR #471) — spec 06 กฎข้อ 12, AC-23 (re-test หลังแก้ D-1/D-2/D-3)
สภาพแวดล้อม: prod build ของ 1ccd0373 (`NODE_ENV=production medusa build` + `medusa start`), DB แยกของ qa, รัน `db:migrate` (migration script ตั้ง default layout) ก่อน seed; env ปลอม ไม่มี Stripe key, provider `pp_system_default`
spec ของ qa 12/12 passed; ชุด D-1 + e2e ของ PR รันซ้ำ 3 รอบ 18/18 passed · Playwright report/trace ฉบับเต็มเป็น CI artifact

| AC / กรณี | Result | Evidence |
|---|---|---|
| AC-23 e2e ของ PR (`pay-10-refund-blocked-widget.spec.ts`) | pass | 1 passed; screenshot ของ e2e เห็น widget บนสุด (แก้ D-3) |
| AC-23 / D-1 ยกเลิก return request ด้วยปุ่ม Cancel Return → widget หายเอง ไม่ reload | pass | qa471-02-cancel-return-no-reload.png (navigation = 0) |
| D-1 ยกเลิก exchange / claim / edit (requested) ผ่าน banner ของ Medusa → widget หายเอง ไม่ reload | pass | ครบ 3 ชนิด, navigation = 0 |
| AC-23 / D-1 เริ่ม return ผ่านเมนู Summary → Create Return แล้วปิด (Esc) → widget ขึ้นเอง "Pending: return request" ไม่ reload | pass | qa471-03-ui-create-return-widget-appears.png |
| AC-23 / D-2 1280×720: widget บนสุดของคอลัมน์หลัก (เหนือ banner/#id/Summary/Payments) เต็มกล่องในจอแรก scrollY=0 | pass | qa471-01-widget-top-1280x720.png |
| D-2 1440×900 และ 1440×720: บนสุดของคอลัมน์หลัก อยู่ในจอแรก | pass | qa471-04-widget-top-1440x900.png |
| reg: กด Refund ขณะมี return ค้าง → 400 + toast ของ PAY-8, refunded_amount = 0, widget ยังอยู่ | pass | qa471-05-refund-toast-400.png |
| reg: order ปกติไม่เห็น widget; หน้า order ปกติ ไม่มี pageerror; widget ไม่เพิ่ม request (preview 1 ครั้ง) | pass | ผล test R-2/R-3 |
| edge: ข้อความ widget ไม่มีอักษรไทย (admin เป็นอังกฤษ) | pass | regex อักษรไทย = false |
| edge: double click Cancel Return | pass | DELETE 200 ×2, widget หาย, หน้าไม่ error |
| edge: รัน `db:migrate` ซ้ำ (จาก source และจาก `.medusa/server`) | pass | layout ไม่เปลี่ยน; script idempotent |
| edge: default ที่แอดมินย้าย widget เอง แล้ว migrate ซ้ำ | pass | ไม่ทับ |
| edge: default มี widget อื่นอยู่แล้ว แล้ว migrate ซ้ำ | pass | merge เก็บ widget อื่นไว้ แล้วใส่ widget นี้ order -1 |
| edge: แอดมินที่บันทึก layout ส่วนตัวไว้ | ข้อจำกัดที่รู้ (ตาม spec กฎข้อ 12) | widget ไปท้ายคอลัมน์หลัก นอกจอแรก; ลบ layout ส่วนตัวแล้วกลับขึ้นบนสุด |
