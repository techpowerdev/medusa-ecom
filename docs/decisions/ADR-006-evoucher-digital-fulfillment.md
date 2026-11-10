# ADR-006 E-voucher = pool โค้ดที่ import จาก partner + Medusa inventory + fulfillment แบบ `digital` + notification

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25) — ปรับปรุง: voucher เป็นโค้ดของ partner; เราไม่ redeem เอง

## บริบท
เราขาย voucher ต่อจาก partner (Lotus, Big C, ห้าง, ร้านกาแฟ) partner ส่งชุดโค้ดให้เราล่วงหน้า
เราต้องส่งโค้ดที่ยังไม่ถูกใช้ให้ครบ 1 โค้ดต่อ 1 หน่วยที่ขาย ทางอีเมล และแสดงสต็อกคงเหลือ
การ redeem เกิดขึ้นที่ partner

## ทางเลือก
1. module `evoucher` ที่มี Partner / Pool / Code; ขนาด pool กำหนด inventory level ของ variant ใน Medusa;
   claim โค้ดแบบ atomic หลัง payment ถูก capture; ส่งมอบผ่านรูปแบบ digital-products
   ที่มีเอกสารรองรับ (custom fulfillment provider + Notification)
2. เก็บโค้ดใน metadata ของ product/variant (ไม่มี atomic claim, ไม่มี audit, ไม่มี masking)
3. ดึงโค้ดจาก API ของ partner สด ๆ ตอนสั่งซื้อ (ปัจจุบันไม่มี partner รายใดมี API)

## การตัดสินใจ
เลือกทางเลือกที่ 1 inventory ยังเป็นของ Medusa (reservations, "สินค้าหมด" บน storefront) และถูกทำให้
เท่ากับจำนวนโค้ด `available` เสมอโดย workflow import/void โค้ด/PIN ถูกเข้ารหัสตอนเก็บ
และถูก mask ใน admin; การเปิดดูถูกบันทึก audit ทางเลือกที่ 3 เพิ่มได้ภายหลังผ่าน interface
code-source โดยไม่ต้องเปลี่ยน order flow

## ผลที่ตามมา
+ ไม่ต้องมี logic สต็อกเอง; Medusa ป้องกัน oversell ที่ระดับ cart ส่วน atomic
  claim ของเรา (`FOR UPDATE SKIP LOCKED`) จัดการ race ของโค้ดสุดท้าย
+ นโยบาย refund ชัดเจน: โค้ดที่ส่งมอบแล้วจะไม่ถูกเรียกคืน
− Admin ต้อง import ชุดโค้ดก่อนเปิดขาย; ต้องมี job สำหรับ low-stock และโค้ดใกล้หมดอายุ
− ต้องมี shipping option "Digital delivery" ฟรี (provider `digital`) และ storefront
  เลือกให้อัตโนมัติสำหรับ cart ที่มีแต่สินค้าดิจิทัล เพื่อให้ `createOrderFulfillmentWorkflow` resolve provider ได้
