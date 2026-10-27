# REPORT QA — AF-12c (PR #176) admin Payouts: สร้าง payout + mark paid

Spec: `docs/spec/05-affiliate.md` กฎ 37, 37c, AC-44 (+ regression AC-26, AF-6/AF-12a) — HEAD `15737e9`
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`, admin `/app`), viewport 1280×800, Stripe key ปลอม, DB แยกที่ seed ใหม่
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40555309980 (Playwright report/trace ฉบับเต็มอยู่ใน artifact ของ job `storefront-e2e`)
ผล: e2e ของ builder (AC-44, AC-26, AC-42) ผ่าน 3 รอบ; QA spec (ในเครื่อง ไม่ได้ commit, browser timezone America/New_York) ผ่าน 2 รอบ; unit 11/11

| AC | Result | Evidence |
|----|--------|----------|
| AC-44 ช่วงวันที่ค่าเริ่มต้น = เดือนก่อนตามเวลาไทย | pass | browser `America/New_York` ยังได้เดือนก่อนตาม ICT; นาฬิกา 2026-11-01 05:00 ICT (= 31 ต.ค. NY) → From/To `2026-10-01`/`2026-11-01`, body `2026-09-30T17:00:00.000Z`/`2026-10-31T17:00:00.000Z` |
| AC-44 dblclick Create → POST 1 ครั้ง แถว `draft` แสดงยอดรวม | pass | หน่วง POST 1.5 วินาที + คลิกซ้ำ → POST 1 ครั้ง; ยอด `THB 300.33` = 100.10+200.20+0.01+0.02 (ขอบเวลา ICT); entry ที่ขอบ exclusive, pending และ paid ไม่ถูกนับ |
| AC-44 affiliate ไม่มี entry → toast ไม่มีแถวใหม่ | pass | toast "Nothing to pay", ไม่มี payout |
| AC-44 mark paid + reference → `paid`, ไม่มีปุ่ม, entry เป็น paid ครบ | pass | reference ถูก trim ก่อนส่ง, dblclick confirm = POST 1 ครั้ง, entry ทั้ง 4 เป็น `paid` — `qa-payout-paid-ny-tz.png` |
| AC-44 ยกเลิก prompt → ไม่มี request | pass | ปุ่ม dismiss และ Esc → ไม่มี POST |
| AC-44 reference ว่าง/ช่องว่าง → body `{}` ได้ 200 | pass | ส่ง `reference: ""` ตรงผ่าน API ได้ 400 (เหตุผลที่ UI ต้องไม่ส่ง key) |
| AC-44 ตัวเลือกมี active + suspended ไม่มี pending | pass | ยิง `status=active&limit=200` และ `status=suspended&limit=200` อย่างละ 1; suspended มีป้าย; pending ไม่อยู่ในรายการ |
| AC-26 (regression + ส่วนเพิ่มจาก qa #138) | pass | e2e `AC-26`; ปุ่ม Mark paid และ Cancel อยู่ในจอที่ 1280×800 |
| กฎ 37 API ล้ม → toast + refetch | pass | create 500 → toast + GET payouts ใหม่ ฟอร์มยังเปิด; mark-paid 500 → toast + refetch แถวยัง `draft` |
| admin ภาษาอังกฤษ / regression Programs, Affiliates, Ledger | pass | ไม่มีอักษรไทย; แท็บอื่นโหลดปกติ; e2e `AC-42` ผ่าน |

## Negative / edge case
- สร้าง payout ซ้ำช่วงเดิม (entry ถูกใช้ไปแล้ว) → 400 + toast "Nothing to pay" — pass
- mark paid ซ้ำผ่าน API บน payout ที่ `paid` แล้ว → 400 reference เดิมไม่เปลี่ยน — pass
- ไม่เลือก affiliate หรือ To ≤ From → error ที่ field ไม่มี POST — pass
- ข้อสังเกต: backend นับ entry `approved` ทั้งหมดก่อน `period_to` (`period_from` ไม่ตัดขอบล่าง ตามกฎ 19 ข้อความใต้ฟอร์มบอกไว้แล้ว); คอลัมน์ Period แสดงวันสิ้นสุดแบบ exclusive; คอลัมน์ Affiliate ล้นขวาที่ 1280px แต่ตารางเลื่อนได้ (ชื่อ/อีเมลเป็นงาน AF-14)

## Defect
ไม่พบ
