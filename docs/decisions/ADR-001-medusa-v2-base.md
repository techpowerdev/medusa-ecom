# ADR-001 สร้างบน Medusa v2 และต่อยอดเท่านั้น

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25)

## บริบท
เจ้าของโปรเจกต์ต้องการร้านค้าระดับ production ที่มีแคมเปญเฉพาะ (flash sale, group buying, affiliate,
e-voucher) และระบุชัดเจนว่าไม่ต้องการสร้างฟีเจอร์ commerce ที่ Medusa มีอยู่แล้วขึ้นมาใหม่

## ทางเลือก
1. ใช้ Medusa v2 เป็น backend + Next.js starter แล้วเพิ่ม module/workflow เฉพาะสำหรับส่วนที่ขาด
2. Mercur (marketplace บน Medusa) — เพิ่มคอนเซ็ปต์ vendor/marketplace ที่เราไม่ต้องใช้
3. เขียน backend ใหม่ทั้งหมดตั้งแต่ศูนย์

## การตัดสินใจ
เลือกทางเลือกที่ 1 ปักเวอร์ชัน `@medusajs/*` ไว้ที่ stable ปัจจุบัน (2.22.x ณ เวลาที่เขียน; Node 22)
การอัปเกรดเป็น task แยกที่มี PR ของตัวเอง โดยอิง upgrade notes ของ Medusa

## ผลที่ตามมา
+ ได้ cart/order/payment/promotion/fulfillment/admin มาใช้ทันทีและยังอัปเกรดต่อได้
+ convention ต่าง ๆ (modules, workflows, links, subscribers, admin extensions) มีเอกสารรองรับและ
  ทดสอบได้ด้วย `medusa-test-utils`
− ฟีเจอร์เฉพาะต้องเข้ากับโมเดล workflow/module ของ Medusa แม้จะมีทางลัดอื่นก็ตาม
− ทุก PR ต้องผ่าน review gate เรื่อง "การสร้างซ้ำ" (ดู reviewer agent)
