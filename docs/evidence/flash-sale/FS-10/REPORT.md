# QA FS-10 — กันกด Save ซ้ำใน widget "Flash sale options" (PR #74, spec 03 AC-16)
ทดสอบเมื่อ 2026-10-26 บน `feat/FS-10-save-inflight` (fe88fed) ด้วย backend แบบ build (`medusa start`) และ Playwright chromium
spec ของ builder ผ่าน 3/3; QA spec ผ่าน 15/15 (5 test × 3 รอบ)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-16 (1) dblclick Save ส่ง POST config 1 ครั้ง (นับด้วย `page.on("request")`) ปุ่ม Save disabled + loading และ Cancel disabled จนกว่า response จะกลับ | ผ่าน | `ac16-1-dblclick-disabled.png` |
| AC-16 (2) response กลับมาแล้ว drawer ปิด และ widget แสดงค่าใหม่ (Per-customer limit = 2) โดยยังมี POST แค่ 1 ครั้ง | ผ่าน | `ac16-2-widget-updated.png` |
| AC-16 (3) Save ครั้งถัดไปส่งได้ตามปกติ (POST ครั้งที่ 2, Total cap = 10) และ GET API ยืนยันว่าบันทึกครบ | ผ่าน | `ac16-3-save-again.png` |
| AC-16 (3) error 4xx (mock 400): drawer ยังเปิด มี toast error ปุ่มกดได้อีก และ Save ซ้ำแล้วส่ง POST ได้สำเร็จ | ผ่าน | `edge-4xx-retry-enabled.png` (toast ไม่ติดในภาพ แต่ test assert ว่า visible) |

## Negative/edge case
| กรณี | ผล |
|------|----|
| dblclick แล้ว POST แรกตอบ 400 | ส่ง POST 1 ครั้ง; หลัง error ปุ่มกลับมากดได้ และ retry สำเร็จ |
| 4xx จริง: ลบ campaign ขณะ drawer เปิด | Save ได้ 404 ทั้งสองรอบ ปุ่มกลับมากดได้ทุกครั้ง (ไม่ค้าง in-flight) |
| คลิก Save 5 ครั้งใน tick เดียว | ส่ง POST 1 ครั้ง |
| กด Escape ระหว่างรอ response | drawer ยังไม่ปิด; หลัง response drawer ปิดและ widget อัปเดต เปิดใหม่แล้ว Save ได้ |

Defect: ไม่พบ · Playwright report และ trace ฉบับเต็มเก็บเป็น CI artifact (14 วัน)
