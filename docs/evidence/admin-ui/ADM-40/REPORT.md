# QA ADM-40 (PR #442) — spec 08 กฎ 44, AC-45 ช่องค้นหาตาราง Affiliates
ทดสอบบน prod build (backend+admin `NODE_ENV=production` build + start) ที่ ce1dc1f1, DB แยกของ qa; affiliate 49 ราย (3 หน้า)
e2e ของ builder `affiliate-admin-search.spec.ts` 1/1; spec ของ qa 13/13; รันซ้ำ C6/C8/C9 ×3 ได้ 12/12 (Playwright report/trace ฉบับเต็มเป็น CI artifact)

| AC / กรณี | ผล | หลักฐาน |
|---|---|---|
| AC-45 ค้นด้วยชื่อ: request ไปที่ `/admin/affiliate/affiliates` มี `q` ตรงคำค้น ได้ `count`=1 ตารางเหลือ 1 แถว URL มี `affiliates_q` (1280×800) | pass | qa442-c1-name-1280.png |
| ค้นด้วยอีเมล (คำที่อยู่ในอีเมลเท่านั้น) ได้ 1 แถว | pass | ผล test C2 |
| เปิดหน้า 2 (`affiliates_offset=20`) แล้วค้น: request ใช้ `offset=0` URL ไม่มี `affiliates_offset` ได้ 1 แถว | pass | qa442-c4-page2-reset.png |
| คำค้นที่ไม่ตรงใคร แสดง "No results / Try changing the filters or search query" ไม่ใช่ "No affiliates yet" | pass | qa442-c5-no-results.png |
| reload แล้วคลิกแท็บ Affiliates: คำค้นคงอยู่ เหลือ 1 แถว มี request เดียวและมี `q` ไม่มีแวบรายการที่ไม่กรอง | pass | qa442-c6-reload-kept.png |
| ล้างช่อง: request ไม่มี `q` ได้ `count` ทั้งหมด ตารางกลับเป็น 20 แถว/หน้า URL ไม่มี `affiliates_q` | pass | ผล test C7 |
| debounce: พิมพ์ 23 ตัวอักษร เว้นตัวละ 40ms ยิง request 1 ครั้งด้วยคำเต็ม | pass | ผล test C8 (×3) |
| ลำดับผล: หน่วง response คำค้นเก่า 4 วินาทีแล้วพิมพ์คำใหม่ ตารางแสดงผลคำใหม่ ไม่ถูกผลเก่าทับ | pass | ผล test C9 (×3) |
| 1440×900: ค้นได้ 1 แถว ช่องค้นหาอยู่ในจอ ไม่ล้นแนวนอน | pass | qa442-c10-name-1440.png |
| edge: แท็บ Programs, Payouts, Ledger ไม่มีช่องค้นหา | pass | ผล test E1 |
| edge: ค้นด้วย code | ไม่พบผล ตรงกับกฎ 21 ที่ค้นแค่ name/email | ผล test C3 |
| edge: `%` / `_` และช่องว่างล้วน | 200 ไม่ error (`%`/`_` เป็น wildcard ของ ilike, ช่องว่างไม่ถูก trim) | ผล test E2 |

ข้อสังเกต (ไม่ผิด spec): ค้นด้วย code ไม่เจอแม้ตารางมีคอลัมน์ Code (กฎ 21 กำหนดแค่ name/email)
