# QA Report — EV-6 (PR #39)

สภาพแวดล้อม: commit `b9a459b`, Node v22.23.3, backend :9115 (`medusa build` แล้ว start จาก `.medusa/server`, NODE_ENV=production),
DB `medusa_qa_ev6` (migrate + seed), Redis db 8, Playwright 1.64.1 (Chromium headless)

หมายเหตุสภาพแวดล้อม:
- โหมด production ตั้ง session cookie เป็น `Secure` จึงส่ง header `x-forwarded-proto: https` เพื่อจำลองการรันหลัง TLS proxy (ไม่ใช่ defect ของ PR)
- ข้อมูลทดสอบ: สร้างสินค้า "Starbucks Card ฿500" (shipping profile Digital) + stock location level ผ่าน admin API ส่วน partner, pool และ import ทำผ่าน UI
- ยังไม่มี EV-4 (allocate) จึงสร้าง order ผ่าน draft order API (`/admin/draft-orders` → `convert-to-order`) qty 2
  แล้วผูก code 2 ตัวด้วย SQL (`status='delivered'`, `order_id`, `order_line_item_id`, `delivered_at`, `delivered_to_email`) — ไม่ได้ปรับ inventory

| AC | ผล | Evidence |
|----|----|----------|
| UI-1 `/app/evouchers` ตาราง pool แสดง Available/Allocated/Delivered/Void + badge Low stock | pass | [01-pool-list.png](01-pool-list.png): Starbucks ฿500 = 96/0/2/0 "Low stock (< 120)"; คลิกแถวแล้วไปหน้า pool |
| UI-1 Partners สร้าง/แก้/ลบ | pass | สร้าง 2 ราย, แก้ใน Drawer, ลบผ่าน Prompt แล้ว DB เหลือ 1 ราย |
| UI-2 / AC-1 import CSV 100 แถว ซ้ำ 2 → สรุปผล | pass | [02-pool-import.png](02-pool-import.png): "Imported 98 codes, skipped 2 duplicates"; inventory ของ variant +98 |
| UI-2 breadcrumb เป็นชื่อ pool | pass | 02/03: "Starbucks ฿500" (ยังเห็นหลัง reload) |
| UI-2 / AC-8 ตาราง code masked + กรองตามสถานะ | pass | ไม่มี code/PIN จริงในตาราง; filter delivered/available/ว่าง ถูกต้อง |
| UI-2 / AC-8 Reveal ต้องยืนยันก่อน + Drawer + audit | pass | [03-reveal-drawer.png](03-reveal-drawer.png): Cancel แล้ว audit ไม่เพิ่ม; Reveal แล้ว `evoucher_code_reveal` +1 แถว |
| UI-3 widget "Voucher pool" บนหน้า variant | pass | [04-variant-widget.png](04-variant-widget.png): partner, face value 500, Available 96 + Low stock, Delivered 2 |
| UI-4 widget "E-vouchers" บนหน้า order | pass | [05-order-widget.png](05-order-widget.png): 2 แถว masked; order ที่ไม่มี voucher ไม่มี widget |

## Negative / edge case
| กรณี | ผล |
|------|----|
| ลบ partner ที่ยังมี pool | toast เตือน ไม่ถูกลบ (pass) |
| สร้าง partner ชื่อว่าง | toast "Name is required" ไม่เรียก API (pass) |
| import CSV ที่ code ว่าง | toast "Invalid CSV: line 2: code is empty" จำนวนไม่เปลี่ยน (pass) |
| import ไฟล์เดิมซ้ำ | "Imported 0 codes, skipped 100 duplicates" inventory ไม่เปลี่ยน (pass) |
| สร้าง pool ซ้ำบน variant เดิม (API) | 400 (pass) |
| double-click Import / Reveal | import ครั้งเดียว, audit +1 แถว (pass) |
| double-click Save ของ Create partner | **ได้ partner ซ้ำ 2 รายการ (D-1)** |
| reveal โดยไม่มี session | 401 (pass) |

## Defect
**D-1 (ต่ำ)** double-submit ของ Create partner สร้างรายการซ้ำ (`isLoading` ยังไม่ทันมีผลก่อนคลิกที่สอง) → follow-up

## ข้อสังเกต (นอกขอบเขต EV-6)
- inventory item ของ voucher ยัง `requires_shipping=true` และ `expires_at` วันที่ล้วนเก็บเป็น 00:00Z → EV-8 (AC-11, AC-12)
- ยังไม่มีปุ่มส่งซ้ำ → EV-5b
- `Label` ในฟอร์ม partner/pool ไม่ผูก `htmlFor`/`id` (accessibility) → follow-up
