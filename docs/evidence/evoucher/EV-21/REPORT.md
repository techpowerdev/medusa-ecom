# QA EV-21 (PR #454) — AC-51 ลบ voucher pool จาก admin + badge "No codes"
prod build (NODE_ENV=production) backend+admin, viewport 1280px, Chromium
รอบแรก d5bf618b: พบ D1 (dblclick ยืนยันทะลุไปแถวใต้ปุ่ม) → re-test D1 @ 64beb5ba: e2e ของ PR 4/4, spec ของ qa 10/10

| AC | Result | Evidence |
|----|--------|----------|
| AC-51 ลบจากตาราง → prompt ระบุจำนวน code (available 3 + void 1 = "4 codes") | pass | qa454-01-table-prompt-4-codes.png |
| AC-51 dblclick ยืนยัน = DELETE 1 ครั้ง; แถวของ pool ที่ลบอยู่ใต้ปุ่มยืนยัน → ยังอยู่ /app/evouchers ไม่เปิดหน้า pool ไม่มี 404 (probe 4/4 รอบ, เดิมล้ม 3/3) | pass | qa454-02-table-dblclick-deleted-stays-on-list.png |
| regression: คลิกเดียวหรือ dblclick ที่แถว → เปิดหน้า pool ตามเดิม | pass | log e2e qa |
| regression: dblclick ปุ่ม Next (3 หน้า) → ไปหน้า 2 (คลิกที่สองถูกข้ามตามที่ยอมรับ); Next/Prev ปกติทำงาน; ActionMenu → Delete → Cancel ทำงาน | pass | log e2e qa |
| กฎ 36b stock ของ variant ลดเท่าจำนวน available (3→0, void ไม่นับ) | pass | log |
| ลบจากหน้า pool → กลับ /evouchers ไม่มี request 404 ไม่มี pageerror | pass | log |
| pool มี code ส่งแล้ว → toast error 36a, pool/แถวยังอยู่ | pass | e2e PR + qa |
| กฎ 36d order รอชำระ (reserved 1) → toast error 36d, pool/stock คงเดิม | pass | qa454-03-reservation-blocked.png |
| pool ว่าง → "No codes" ไม่มี "Low stock" ทั้งตารางและหน้า pool; pool 1 code (threshold 20) ยังขึ้น Low stock | pass | qa454-04-no-codes-table.png, qa454-05-no-codes-pool-page.png |
| edge: DELETE ผ่าน API พร้อมกัน 2 ครั้ง → 200 + 404, stock ลดครั้งเดียว | pass | log |

Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #454 (14 วัน)
