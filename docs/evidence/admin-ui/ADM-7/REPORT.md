# QA ADM-7 — ฟอร์มสร้างแคมเปญ group buy (PR #301, `4a6a8f8`)

Spec: `docs/spec/08-admin-ui-medusa-components.md` AC-10 (กฎ 4, 5, 8), `docs/spec/04` กฎข้อ 30d (AC-50) และกฎข้อ 33d (AC-52, AC-58)
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`), Playwright chromium, `timezoneId: Asia/Bangkok`, `locale: en-US`, viewport 1280×800, workers ≤ 2
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #301 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-10 e2e `group-buy-admin-form` ผ่าน (dblclick = 1 POST, `gb-max-quantity-error`, `gb-ends-at-warning`, picker ข้ามหน้า, idempotency AC-52) | pass | regression 16/16; qa-validation-max-quantity.png |
| AC-10 กรอกเวลาไทย 2026-12-01 10:00 / 2026-12-31 23:30 → body `2026-12-01T03:00:00.000Z` / `2026-12-31T16:30:00.000Z` และ `Meta/Control+Enter` ส่ง 1 ครั้ง | pass | test AC-10 ผ่าน; SQL `promotion_campaign` เก็บ 03:00 / 16:30 UTC; ac10-datepicker-ict.png |
| AC-10 ข้ามวัน ข้ามเดือน ข้ามปี และปีอธิกสุรทิน (QA) | pass | 12/1/2026 05:30 ICT → `2026-11-30T22:30Z`; 1/1/2027 06:59 ICT → `2026-12-31T23:59Z`; 3/1/2026 00:00 → `2026-02-28T17:00Z`; 2/29/2028 23:59 → `2028-02-29T16:59Z` (body และ DB ตรงกัน); ac10-datepicker-ict.png |
| AC-10 static: `product-picker` ใช้ `useProducts` และ `create-campaign` ใช้ `DatePicker` ไม่มี `datetime-local` | pass | unit `medusa-ui.unit.spec.ts` ผ่าน; e2e เห็น `GET /admin/products?q=...` |
| AC-10 unit `group-buy-form.unit.spec.ts` | pass | jest 2 suites ผ่าน 112 tests |
| AC-50 (กฎ 30d) picker เลือกได้สินค้าเดียว เปลี่ยนแล้วค่าก่อนหน้าถูกแทน | pass | เลือก A แล้วเลือก B เหลือ B ตัวเดียว `target_rules = [B]`; ไม่มี checkbox เลือกทั้งหน้า; ค้นคำที่ไม่เจอแล้วกลับมา B ยังติ๊กอยู่; qa-picker-single-select.png |
| กฎ 4 / กฎ 8 กันกดซ้ำ | pass | หน่วง response ไว้ 2.5 วินาที แล้ว dblclick Create ตามด้วย `ControlOrMeta+Enter` อีก 2 ครั้ง → POST 1 ครั้ง ได้แคมเปญเดียว (ยืนยันทั้ง API และ DB) |
| AC-52 / 33d network ล้มหลัง request ถึง backend แล้วส่งซ้ำ | pass | ส่งซ้ำได้ key เดิม ได้ 200 และมีแคมเปญเดียว (DB count = 1) |
| AC-52 กด Esc ปิดแล้วเปิดใหม่ | pass | ได้ key ใหม่ ช่อง Name ถูก reset เป็นค่าว่าง และได้แคมเปญใหม่ |
| AC-58 / 33d เปิดผ่าน http ด้วย IP วง LAN | pass | `isSecureContext=false`, `crypto.randomUUID` เป็น undefined แต่ยังสร้างแคมเปญได้ (200) และ key เป็นรูป UUID; qa-lan-http-created.png |

## Negative / edge (ทุกกรณีไม่มี POST และไม่มีข้อความ "Invalid input")
| กรณี | ผล | ข้อความ / ที่แสดง |
|------|----|------------------|
| ไม่มี Name | ไม่ส่ง | toast "Name is required" (qa-validation-name-required.png) |
| End ก่อน Start | ไม่ส่ง | toast "End date must be after start date" |
| End = Start | ไม่ส่ง | toast เดียวกับข้างบน |
| ไม่กรอก End | ไม่ส่ง | toast "End date is required" |
| End กรอกไม่ครบ (มีแค่เดือนกับวัน) | ไม่ส่ง | toast "End date is required" |
| max quantity 2 < max per person 5 | ไม่ส่ง | ใต้ช่อง `gb-max-quantity-error` "Max discounted quantity must be at least max units per person" |
| ไม่เลือกสินค้า | ไม่ส่ง | `gb-product-required-error` "Select the product of this campaign" และ error หายเมื่อเลือกสินค้า |
| Start ในอดีต | ส่งได้ (200) | spec ไม่ได้กำหนดให้ห้าม จึงบันทึกไว้เป็นพฤติกรรม |
| กด Esc ระหว่างที่ POST ค้างอยู่ | modal ไม่ปิด | ปิดเองหลังได้ response |

## Defect
ไม่พบ

## Observation (ไม่ใช่ defect)
1. error ที่ไม่ผูกกับช่องใด (Name, ลำดับวันที่, End ว่าง) แสดงเป็น toast มุมขวาบน ไม่ได้อยู่ใต้ช่อง และ toast ทับปุ่ม Create ชั่วคราว ตรงกับที่ PR ระบุไว้ว่านอกขอบเขต ถ้าต้องการให้อยู่ใต้ช่องควรเป็น task แยก
2. builder หยุดที่ error แรกทีละข้อ ถ้ามีหลายข้อผิด admin จะเห็นทีละข้อ
3. ข้อจำกัดของการทดสอบ LAN: prod ตั้ง session cookie เป็น `Secure` ทำให้ login ผ่าน UI บน http ที่ไม่ใช่ localhost ไม่ติด (spec 07 Deliverables ข้อ 11 — prod ต้องอยู่หลัง HTTPS) จึงจำลองโดย login ผ่าน API (`/auth/session`) แล้วใส่ cookie แบบไม่ secure ให้ origin LAN ส่วนฟอร์มทำงานใน non-secure context จริง
4. หัวคอลัมน์ "Ends (ICT)" ในหน้ารายการยังเขียน ICT ทั้งที่ตอนนี้แสดงตาม timezone ของเครื่อง (กฎ 5) เป็นเรื่องเล็กของหน้ารายการ ไม่อยู่ใน ADM-7

## สรุป
AC-10 ผ่านครบ รวมถึงกฎ 30d (สินค้าเดียว) และกฎ 33d (idempotency key, http บน LAN) regression `group-buy-admin-*` ผ่าน 16/16 ไม่มี defect
