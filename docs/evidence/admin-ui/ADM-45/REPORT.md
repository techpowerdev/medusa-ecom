# QA ADM-45 — คอลัมน์ Affiliate ของ Payouts กว้าง 250px ที่จอใหญ่ (PR #507, spec 08 กฎ 49, AC-50)
ตรวจ commit `e1855d50` บน prod build (`NODE_ENV=production pnpm --filter backend build` + `medusa start`, ไม่มี "Development Mode" ใน asset admin)
CSS ที่ build แล้วมี `@media(min-width:1536px){.2xl\:w-[250px]{width:250px}}` และ `.w-[126px]{width:126px}`
ข้อมูลทดสอบ 15 แถว:
- affiliate ชื่อยาว 370 ตัว + อีเมลยาว
- ชื่อสั้น + อีเมลสั้น
- ชื่อสั้น + อีเมลยาว
- ไม่มีชื่อ (ไม่พบ affiliate จึงแสดง `affiliate_id`)
- payout paid ยอด ฿123,456.78 พร้อมวันที่สองหลัก
- draft ยอด ฿999,999.99 กับ reference 320 ตัว

| AC | Result | Evidence |
|----|--------|----------|
| AC-50 (1920×1080): เนื้อหา cell Affiliate ∈ [240, 250.5]px, ปุ่ม `…` อยู่ในจอ, ตารางไม่ล้น | pass | qa507-1920-payouts.png — td 274 / เนื้อหา 250px ทุกแถว, กล่องเลื่อน scrollWidth 1576 = clientWidth 1576, scrollLeft 0, ขอบขวาของปุ่ม `…` ≤ 460px |
| AC-50 (1440×900): ไม่ล้น, ปุ่ม `…` ในจอ, Affiliate 126px | pass | test AC-50/AC-46 1440 ผ่าน — กล่องเลื่อน 1196 = 1196, เนื้อหา 126px |
| AC-50 (1280×800): ไม่ล้น, ปุ่ม `…` ในจอ, Affiliate 126px | pass | qa507-1280-payouts.png — กล่องเลื่อน 1036 = 1036, เนื้อหา 126px, ขอบขวาของปุ่ม `…` ≤ 361px |
| Breakpoint `2xl` 1536 (และ 1537/1560/1600): ไม่ล้น | pass | qa507-1536-payouts.png — เนื้อหา 250px, ตาราง 1292 = กล่อง 1292; ความกว้างขั้นต่ำของตาราง (min-content) 1127.6px เหลือ 164px |
| 1535 (ต่ำกว่า breakpoint 1px): ไม่ล้น, Affiliate 126px | pass | qa507-1535-payouts.png — ตาราง 1291 = กล่อง 1291, เนื้อหา 126px |
| Tooltip "ชื่อ อีเมล" เต็มทุกความกว้าง (1920/1536/1535/1440/1280); ชื่อสั้นไม่ถูกตัดและไม่มี tooltip | pass | qa507-1920-tooltip.png — tooltip ตรงกับ `${name} ${email}` ทุกความกว้าง; ชื่อสั้น scrollWidth ≤ clientWidth และ hover 1.2 วินาทีไม่มี tooltip |
| เมนู `…` (Mark paid/Cancel) เปิดได้ และ Escape ครั้งเดียวปิดพร้อม focus กลับปุ่ม (1920, 1280) | pass | test QA (menuitem หาด้วย role + ชื่อ) + `admin-row-menu-escape.spec.ts` "affiliate payouts" ผ่าน |

ผล test (prod build, port 9257):
- test ของ PR `-g "ADM-45|ADM-41"` ผ่าน 5/5
- spec QA ชั่วคราว (1920/1600/1560/1537/1536/1535/1440/1280 + tooltip + Escape) ผ่าน 1/1 — รอบแรกล้มเพราะ test ของ qa เอง: tooltip ของชื่อยาวทับแถวล่างแล้ว hover ค้าง จึงแก้เส้นทางเมาส์ใน test (ไม่ใช่ defect)
- regression: `admin-table-long-text.spec.ts` ทั้งไฟล์ + `admin-row-menu-escape.spec.ts` + `affiliate-admin-payouts.spec.ts` ผ่าน 20/20
- report/trace ฉบับเต็มดูที่ CI artifact `e2e-evidence` (14 วัน)

Edge case:
- ชื่อสั้น + อีเมลยาว: ถูกตัดที่ความกว้างของ cell (250 ที่ ≥1536, 126 ที่ ≤1535) และมี tooltip ตามคาด
- ไม่มีชื่อ (affiliate ไม่พบ): แสดง `affiliate_id` ในความกว้างเดียวกัน ตารางไม่ล้น
- หลายแถว (15 แถว ผสม draft/paid): ทุกแถวเนื้อหากว้างเท่ากัน และปุ่ม `…` ทุกแถวอยู่ในจอ

Defect: ไม่พบ

ข้อสังเกต (ไม่ใช่ defect เพราะ spec ไม่ได้กำหนด):
- O-1: ช่วง 1440–1535 ตารางยังมีที่ว่างเหลือ (min-content 1003.6px เทียบกล่อง 1196px ที่ 1440 เหลือ 192px) แต่ Affiliate ยังเป็น 126px ส่วนคอลัมน์ Status/actions ยังกว้าง 150px ตามค่าเริ่มต้น (มีมาตั้งแต่ ADM-41)
- O-2: tooltip ของชื่อยาวมาก (370 ตัว) เป็นกล่องสูงที่ทับแถวด้านล่าง และค้างอยู่เมื่อเลื่อนเมาส์ผ่าน (พฤติกรรมเดิมของ `TruncatedCell`/Radix)
