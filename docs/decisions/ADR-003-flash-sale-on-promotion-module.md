# ADR-003 Flash sale = Medusa Campaign + Promotion แบบอัตโนมัติ; module `flash_sale` แบบบางสำหรับส่วนที่ขาด

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25)

## บริบท
Promotion module ของ Medusa มี campaign พร้อมเวลาเริ่ม/สิ้นสุด, budget (spend/usage),
การใช้ส่วนลดอัตโนมัติ, target rules และจำนวนสูงสุดต่อ cart อยู่แล้ว

## ทางเลือก
1. ใช้ Campaign/Promotion สำหรับส่วนลด แล้วเพิ่ม module แบบบางสำหรับ limit ต่อลูกค้า
   และ countdown/price preview บน storefront
2. Medusa **Price List** `type: sale` พร้อม `starts_at/ends_at` — ไม่ต้องเขียนโค้ดเลย starter แสดงราคาขีดฆ่าให้อยู่แล้ว
   แต่ไม่มี budget ("N ชิ้นแรก"), ไม่มี limit ต่อลูกค้า และไม่มีบรรทัดส่วนลดระดับ order
3. ทำ pricing engine "flash sale" แยกที่ไปแก้ราคาตามตารางเวลา

## การตัดสินใจ
เลือกทางเลือกที่ 1 เพราะต้องมี budget และ limit ต่อลูกค้า แคมเปญที่ไม่ต้องใช้ทั้งสองอย่าง
(ลดราคาตามช่วงเวลาแบบง่าย) ให้ใช้ sale Price List โดยไม่ต้องเขียนโค้ด โค้ดของเราไม่คำนวณจำนวนส่วนลดเองเลย
ทำเพียง validate limit และเปิดข้อมูลแคมเปญแบบอ่านอย่างเดียวให้ storefront

## ผลที่ตามมา
+ Admin ใช้ UI promotion ของ Medusa; กฎการซ้อน/exclusivity เป็นของ Medusa
+ ยอดส่วนลดใน cart/order สอดคล้องกับรายงานของ Medusa
− limit ต่อลูกค้าต้องมี counter ของเราเองและ validation hook ตอน cart completion
− preview "ราคา flash" ต้องมี store endpoint ที่เรียก Promotion compute บน line สังเคราะห์
