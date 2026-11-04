# QA ADM-8a (PR #304, head `6034425`) — ตาราง affiliate ใช้ DataTable ของ dashboard

spec: `docs/spec/08-admin-ui-medusa-components.md` (AC-2 ส่วน affiliate, AC-11) · prod build (`medusa build` + `medusa start`) · Playwright `locale: "en-US"`, `timezoneId: "Asia/Bangkok"` · viewport 1280×800 และ 1440×900
Playwright report/trace ฉบับเต็มดูจาก CI artifact `e2e-evidence` ของ PR #304 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-2 (affiliate) route `affiliate` มี `icon` (`ReceiptPercent`) แสดงใน sidebar, `ICON_PENDING` ว่าง และมี assertion กันลืมลบ | pass | ac2-sidebar-icon.png, unit `medusa-ui.unit.spec.ts` 92/92 |
| AC-11 Ledger: entry `1234.5` THB แสดง `฿1,234.50` ไม่มี `THB` ในตาราง; Created แสดง `Nov 5, 2026 2:19 AM` ตรงกับเวลาไทย (UTC 19:19); ยิง `id[]` 1 ครั้งต่อหน้า | pass | ac11-ledger-amount.png, `affiliate-admin-tables` |
| AC-11 Payouts: period `2026-01-15T17:30Z` แสดง `Jan 16, 2026` (ไม่ใช่ Jan 15); กด Next แล้ว URL มีแค่ `payouts_offset=20`; หน้า 2 แถวแรกเป็นชื่อ/อีเมลของ affiliate คนที่สอง ไม่มีชื่อจากหน้า 1 ค้าง | pass | ac11-payouts-page2-names.png |
| AC-11 offset ต่อแท็บ: แต่ละ prefix แยกกัน (`ledger_offset=40` กับ `payouts_offset=20` อยู่ใน URL พร้อมกันได้โดยไม่ชน); reload แล้วกลับเข้าแท็บเดิมยังอยู่หน้า 2 | pass | QA spec (log `2 of 13 pages`) |
| AC-11 static: ไม่มี `lib/affiliate-format.ts`, ไม่มี `as unknown as`, ตั้ง `keepPreviousData`, unit assert `id`/`limit` | pass | unit 92/92, grep |
| AC-11 e2e `affiliate-admin-*` เดิมผ่าน (workers=2, รัน 4 รอบบน DB เดิมโดยไม่ล้างข้อมูล — blocker ของ review เรื่องแถวถูกดันไปหน้า 2 ไม่เกิดซ้ำ) | pass | 28/28 |
| ปุ่ม Create program/payout อยู่ใน Header และกดแล้วเปิด dialog ได้ | pass | vp1440-programs.png |
| ไม่มีแถว toolbar ว่าง (Programs/Payouts ใช้ `subHeading`) ทั้ง 1280×800 และ 1440×900; หน้าไม่ล้นแนวนอน | pass | vp1440-programs.png |

## Negative/edge
| กรณี | ผล |
|------|----|
| `<prefix>_offset=abc` / `-20` / `20abc` (ทั้ง 4 prefix) | URL ถูก replace เป็นหน้าแรก ไม่มี NaN ไม่ค้าง |
| `=1.5` | URL กลายเป็น `=1` ตารางแสดงแถวที่ 2–21 ข้อความบอกหน้า `1 of 2 pages` |
| `=1e3`, `=999999` | ไม่มี NaN ไม่ค้าง แสดง empty state แต่ข้อความบอกหน้าเป็น `50000 of 2 pages`, ปุ่ม Next disabled, กด Prev ได้ `=999960` ซึ่งยังว่าง (edge-offset-huge.png) |
| `=99999999999999999999` | ไม่มี NaN ไม่ค้าง แต่ backend ตอบแถวหน้าแรก 20 แถวพร้อม `offset: 1e20` ส่วน UI บอกว่าอยู่หน้า `5000000000000000000 of 10` |
| รัน regression ซ้ำบน DB เดิม | 4 รอบ 28/28 |

## Defect
ไม่พบ

## Observation (ไม่ใช่ AC ของ ADM-8a)
1. **ADM-10:** offset ที่เกินจำนวนแถวไม่ถูก clamp ทำให้ข้อความบอกหน้าผิด (`50000 of 2 pages`) และกด Prev ก็ยังไม่กลับมาหน้าที่มีข้อมูล ต้องลบ param ออกจาก URL เอง
2. **backend (spec 05):** `GET /admin/affiliate/payouts` รับ `offset` ที่เกิน safe integer ได้ (`1e20`) แล้วกลับคืนแถวหน้าแรก ควรมี validation ให้ตอบ 400 หรือ clamp
3. แท็บที่เลือกไม่ได้เก็บใน URL พอ reload จะกลับไปแท็บ Programs (offset ของแท็บอื่นยังคงอยู่) ตรงกับที่ PR แจ้งไว้
4. Programs/Payouts มี Header (ชื่อ + ปุ่ม Create) แยกจากแถว `subHeading` และเว้นระยะมากกว่า Ledger/Affiliates ซึ่งจะหายไปเมื่อทำ ADM-14 (ปุ่มเข้า `action`)
5. ที่ 1280×800 ตาราง Payouts ตัดคอลัมน์สุดท้าย (Payout id) ต้องเลื่อนแนวนอนภายในตาราง
6. icon `ReceiptPercent` ของเมนู Affiliate ซ้ำกับเมนู Promotions ของ Medusa spec ไม่ได้ห้ามไว้ แต่ทำให้แยกสองเมนูด้วยสายตายาก

## สรุป
AC-2 (affiliate) และ AC-11 pass ไม่มี defect ส่วน observation ข้อ 1 และ 2 ส่งต่อให้ ADM-10 และ backend affiliate
