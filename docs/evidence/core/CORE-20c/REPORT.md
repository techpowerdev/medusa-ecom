# QA — CORE-20c (PR #130)
Spec: `docs/spec/01-core-medusa.md` (origin/develop) กฎข้อ 60, AC-96; regression AC-65 · commit `ede2a77` (#124 ยังไม่ merge) · prod build :9183/:8183 · Playwright report/trace ฉบับเต็มอยู่ใน CI artifact ของ PR #130
ผลรวม: e2e PR 3 passed · e2e QA 4 passed (ไม่ได้ commit) · Vitest 302 passed

| AC | Result | Evidence |
|----|--------|----------|
| AC-96 qty 3 / fulfilled 3 / shipped 2 / requested 1 → เลือกได้สูงสุด 1 | pass | 01-return-max-shipped.png |
| AC-96 ส่งบางส่วน (fulfill 3 ship 2 ยังไม่มีคำขอ) → ตัวเลือก 0..2 | pass | e2e QA test 2 |
| AC-96 URL /th แต่ region ของ order = 7 วัน → ปุ่มคิดจาก 7 วัน | pass | 02-return-button-order-region.png (ส่งวันนี้มีปุ่ม), 03-qa-window-7d-expired.png (ส่ง 8 วันก่อนไม่มีปุ่ม ขณะที่ region th = 30) |
| AC-96 admin แก้ค่า → ปุ่มเปลี่ยนทันที; ลบ key → ใช้ 30 วัน | pass | e2e QA test 1 (7→ไม่มี, 10→มี, 7→หาย, ลบ key→มี); e2e PR (ตั้ง 0→ไม่มี) |
| AC-96 ส่ง return แล้วหน้า order detail เห็นสถานะใหม่ทันที | pass | e2e PR test 1 + QA test 2 (ปุ่มหายทันที, admin เห็น return requested 1 รายการ) |
| AC-96 /th/account/orders แสดงข้อมูลล่าสุด | pass | e2e QA test 2 (เปิดหน้าไว้ก่อน สั่ง order ใหม่ → order-card เป็น 2 ทันที) |
| AC-96 /th/returns + JSON-LD แสดงค่าใหม่โดยไม่ redeploy | pass (มีหมายเหตุ) | 05-qa-returns-policy-updated.png; ค่าใหม่ขึ้นที่ /th/returns 71 วินาที, หน้าแรก 77 วินาที, หน้าสินค้า 85 วินาที ตามกลไก ISR revalidate=60 (request แรกหลังครบ 60 วินาทียังได้หน้าเก่า) |
| AC-96 grep ไม่มี force-cache / unit returnableItems, canRequestReturn | pass | Vitest return-policy-cache.test.ts, return-request.test.ts |
| AC-96 e2e ใช้ region แยกและคืนค่าเดิม | pass | หลังรันเหลือแค่ region Thailand ค่า return_window_days=30 |
| error ไทยจาก backend (#124) | ไม่ได้ตรวจ | #124 ยัง OPEN ตอนตรวจ มีแค่ unit test ของ map ข้อความ |
| AC-65 (regression) | pass | e2e core-20-return-request.spec.ts |

## Edge case

| กรณี | ผล |
|------|------|
| เปิดฟอร์มค้างไว้ แล้ว admin ตั้งช่วงคืน 0 → กดส่ง | pass: return-error "คำสั่งซื้อนี้ไม่สามารถขอคืนสินค้าได้แล้ว" ไม่มีคำอังกฤษ ไม่มี return ถูกสร้าง (04-qa-window-closed-error.png) |
| ขอคืนผ่าน API ไปก่อน แล้วกดส่งจากฟอร์มที่เปิดค้าง | pass: error ไทย มี return 1 รายการ |
| กดส่งสองครั้งติด (double-click) | pass: return requested 1 รายการ |

## ข้อสังเกต (ไม่ใช่ AC fail)
1. ลบ `return_window_days` ของ region → ปุ่มใช้ 30 วัน แต่ `/th/returns` แสดง "ยังไม่ได้เผยแพร่รายละเอียดนโยบายสำหรับภูมิภาคนี้" และ JSON-LD ไม่มี `MerchantReturnPolicy`
2. ค่าใหม่ขึ้นภายใน 71–85 วินาที (ISR revalidate=60 + request แรกได้หน้าเก่า)
3. หลังเกิด `return-error` ฟอร์มรีเซ็ตจำนวนที่เลือกกลับเป็น 0
