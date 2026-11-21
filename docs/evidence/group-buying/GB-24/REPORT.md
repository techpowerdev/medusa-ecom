# GB-24 — QA PR #436 (spec 04 Follow-up รอบ 40, AC-66)
ทดสอบบน prod build (backend NODE_ENV=production build+start, storefront build+start) DB ใหม่ที่ migrate+seed แล้ว

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-66a starts_at อยู่ในอนาคต → ไม่มี `group-join`/`group-join-button`/`group-create-team-button`/`group-units-limit` และไม่มี select/input ของตัวเลือกสินค้า; `group-starts-at` = "เริ่ม 23 พ.ย. 2569 01:15" (ตั้ง 18:15 UTC ซึ่งข้ามวันเมื่อแปลงเป็นเวลาไทย จึงพิสูจน์ได้ว่าใช้ Asia/Bangkok) อักษรไทย ไม่มีคำละติน | pass | 01-group-not-started-desktop.png |
| AC-66a login แล้วก็ยังไม่มีฟอร์ม join | pass | e2e qa436 (1) |
| AC-66a มือถือ 375px: เห็น starts-at ไม่มีฟอร์ม ไม่เลื่อนแนวนอน | pass | 01-group-not-started-mobile.png |
| ถึงเวลาเริ่ม (SQL เลื่อน starts_at เป็นอดีต) → reload แล้วฟอร์ม join กลับมา `group-starts-at` หายไป (หน้าเป็น dynamic + GB-11 ใช้ no-store ไม่ต้องรอ ISR) | pass | 01-group-not-started-after-start.png |
| AC-66b `group-share-link` = `/th/g/<token>` ทั้งตอนยังไม่เริ่มและเริ่มแล้ว; กด `group-share-copy` แล้ว clipboard = `http://localhost:8236/th/g/<token>`, status เป็นภาษาไทย; เปิดลิงก์ที่คัดลอกใน tab ใหม่ได้ 200 และเห็น `group-page` | pass | 01-group-not-started-share-copy.png |
| AC-66b การ์ดหน้าแรก `group-pool-link` "เข้าร่วมกลุ่มเปิด" href = `/th/g/<token>` (cc ไม่ซ้ำ) คลิกแล้วไปถึงหน้ากลุ่มที่มี `group-join-button` | pass | 01-group-not-started-home-pool-link.png |
| Regression: แคมเปญที่เริ่มแล้วยังเห็นฟอร์ม join ปกติ ไม่มี `group-starts-at` | pass | e2e qa436 (3) + group-buy-join 7 เคส |
| ลิงก์เก่า `/g/<token>` redirect ไป `/th/g/<token>` (200) | pass | e2e qa436 (3) |
| Negative: POST join ผ่าน API ตอนยังไม่เริ่ม → 400 `not_allowed` "The group buy campaign is outside its active time window" (backend กันไว้ตามกฎข้อ 10) | pass | log e2e qa436 (1) |

e2e ของ PR + regression: 17 passed; สคริปต์ qa: 4 passed; Vitest group-page: 18 passed
Playwright report/trace/video ฉบับเต็มอยู่ใน CI artifact (14 วัน)

ข้อสังเกต (ไม่ใช่ defect): ตอนยังไม่เริ่ม การ์ดความคืบหน้ายังแสดงนับถอยหลัง "เหลือเวลา" ของ ends_at ของกลุ่ม · หน้าที่เปิดค้างไว้ต้อง reload เมื่อถึงเวลาเริ่ม (render ฝั่ง server) · ลิงก์แชร์ยังแสดงตอนยังไม่เริ่มตามกฎข้อ 49
