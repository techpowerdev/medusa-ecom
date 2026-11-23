# QA ADM-41 — ตาราง Payouts ไม่ล้นที่ 1280/1440 (PR #452, spec 08 AC-46)
prod build backend+admin (`NODE_ENV=production`, `medusa start`) commit 46bdff6a; payout จริงผ่าน admin API (id `affpay_`+ULID), ชื่อ affiliate 370 ตัวอักษร, reference 320 ตัวอักษร

| AC | Result | Evidence |
|----|--------|----------|
| AC-46 (1280) | pass | qa452-ac46-1280-tooltip-name.png — กล่องเลื่อนภายใน scrollWidth 1036 = clientWidth 1036, ปุ่ม … ทุกแถวอยู่ในจอ, tooltip ชื่อ/reference/id เต็ม |
| AC-46 (1440) | pass | qa452-ac46-1440-tooltip-reference.png — กล่องเลื่อน 1196 = 1196, tooltip ครบ 3 cell |
| 1920: ส่วนเกินอยู่ที่ Amount/Period/Paid at | pass | qa452-1920-widths.png — Affiliate 150 / Reference 124 / Payout 124 คงที่ |
| Regression: Mark paid / Cancel draft | pass | qa452-regression-markpaid-cancel.png — ดับเบิลคลิกยืนยัน Mark paid → POST 1 ครั้ง, ตารางยังไม่ล้น; Cancel draft → DELETE 1 ครั้ง |
| Regression: แท็บอื่น (Programs/Affiliates/Ledger ที่ 1280) | pass | qa452-other-tab-affiliates.png |

ผล test: spec QA --repeat-each=2 → 10/10; test ของ PR 2/2; admin-table-long-text + affiliate-admin-payouts/row-actions/tables 16/16; evidence-budget ผ่าน. report/trace ฉบับเต็มดูที่ CI artifact (14 วัน)

ข้อสังเกต: คอลัมน์ Affiliate 150px เห็นชื่อราว 15 ตัวอักษร (ตามกฎ 45 อาศัย tooltip); คอลัมน์ Status/actions กว้างค่าเริ่มต้น 150 ที่ 1440/1920 เห็นช่องว่าง (PR ไม่ได้แตะ)
