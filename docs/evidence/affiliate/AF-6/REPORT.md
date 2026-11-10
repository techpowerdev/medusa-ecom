# QA — AF-6 หน้า Affiliate ใน admin + ปุ่มยกเลิก payout draft (PR #138)

Spec: `docs/spec/05-affiliate.md` AC-26 (รวมส่วนที่เพิ่มรอบ 10) + หัวข้อ "Admin UI / Storefront"
- รอบ 1 · commit `c62eedb` · Chromium 1280×720
- รอบ 2 · commit `0b9a48f` · Chromium 1280×800, `timezoneId=America/New_York` (พิสูจน์ว่าเวลาไม่ขึ้นกับเครื่อง)

สภาพแวดล้อม: backend `medusa start` (prod build, `NODE_ENV=production`), `ALLOW_TEST_PROVIDERS=true`, DB/Redis db แยก, Stripe ใช้ค่าปลอม
รอบ 2: e2e 7 test (qa รอบ 2 ×3, regression รอบ 1 ×3, builder `affiliate-admin-payouts.spec.ts` ×1) ผ่าน 2/2 รอบ; unit `affiliate-format` + `affiliate-payout` 4/4

| AC | Result | Evidence |
|----|--------|----------|
| AC-26 เฉพาะแถว `draft` มี `affiliate-payout-cancel` (แถว `paid` ไม่มี) | pass | 01-payouts-1280x800.png |
| AC-26 (รอบ 10) ที่ 1280×800 ปุ่มอยู่ในจอโดยไม่เลื่อนตาราง | pass | 01-payouts-1280x800.png — ปุ่มที่ x=320, y=295 (กว้าง 59) ไม่มีการเลื่อน (`scrollX`/`scrollLeft` = 0) |
| AC-26 (รอบ 10) ยกเลิกไม่สำเร็จ → toast error + refetch | pass | 02-cancel-failed-refetch.png — mark-paid ผ่าน API ระหว่างเปิดหน้า แล้ว DELETE ได้ 400 ขึ้น toast "Only draft payouts can be cancelled" มี GET `/admin/affiliate/payouts` ตามมา แถวเป็น paid และไม่มีปุ่ม หน้าไม่ reload |
| AC-26 กดแล้วปิดกล่องยืนยัน (Keep payout และ Escape) → ไม่มี request | pass | 03-confirm-prompt.png — DELETE 0 ครั้ง |
| AC-26 dblclick แล้วยืนยัน → DELETE 1 ครั้ง แถวหายโดยไม่ reload + toast | pass | 04-draft-cancelled.png — toast "Payout cancelled" และ GET payout ได้ 404 |
| Admin UI: เวลาแสดงตาม Asia/Bangkok | pass | browser ตั้งเป็น New York: starts_at `…T17:30Z` แสดง "Oct 8, 2026, 12:30 AM" (ไม่ใช่ 1:30 PM); paid_at และ period ตรงกับค่าที่คำนวณแบบ Asia/Bangkok |
| Admin UI: จำนวนเงินรูปแบบ "THB x,xxx.xx" | pass | Ledger และ Payouts แสดง "THB 1,234.50" กับ "THB 250.00" |
| Admin UI: Programs / Affiliates / Ledger / Payouts โหลดรายการ, เปลี่ยนหน้า (pageSize 20), empty state | pass | regression รอบ 2 ผ่าน (Next ไป `offset=20`, ทั้ง 4 แท็บยิง GET ของตัวเอง) |
| ปุ่ม admin กันกดซ้ำ (CLAUDE.md) | pass | คลิกรัว 4 ครั้งเปิดกล่องเดียว; dblclick ยืนยัน → DELETE 1 ครั้ง; ระหว่าง DELETE ปุ่มทุกแถว disabled และบังคับคลิกแถวอื่นไม่เปิดกล่อง |
| ข้อความ admin เป็นภาษาอังกฤษ | pass | ไม่มีอักษรไทยทั้ง 4 แท็บ |

## Negative / edge
| กรณี | ผล |
|------|----|
| payout ถูก mark-paid ระหว่างที่หน้ายังแสดง draft | pass — 400, toast error, refetch, แถวกลายเป็น paid ไม่มีปุ่ม (รอบ 1 พบว่าไม่ refetch → แก้แล้วในรอบ 2) |
| หลังยกเลิกไม่สำเร็จ ยกเลิกแถวอื่นต่อ | pass — DELETE 1 ครั้ง แถวหาย (การกันกดซ้ำถูกปลดหลัง error) |
| หลัง DELETE ที่ถูกกักไว้ปล่อยออกไป ยกเลิกแถวถัดไป | pass — เปิดกล่องได้ DELETE 1 ครั้ง |

## ข้อสังเกต (ไม่ใช่ defect)
- รอบ 2 ย้าย Status/Cancel ไปไว้ซ้าย ทำให้คอลัมน์ Affiliate อยู่ขวาสุดและถูกตัดที่ 1280px ต้องเลื่อนตารางเพื่อดู id เต็ม
- ข้อสังเกตรอบ 1 ทั้งสองข้อ (ปุ่มอยู่นอกจอที่ 1280px และ error แล้วไม่ refetch) แก้แล้วตาม AC-26 รอบ 10

รายงานและ trace ฉบับเต็ม: CI artifact ของ https://github.com/techpowerdev/medusa-ecom/actions/runs/40487293548 (14 วัน; รอบ 1: runs/40475856795)
