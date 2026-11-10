# QA — ADM-4 หน้า admin e-voucher (spec 08 AC-7) PR #296 @ `60306d6`

สภาพแวดล้อม: prod build (`medusa build` + `medusa start`), Playwright chromium ใช้ worker ไม่เกิน 2, locale `en-US`, timezone `Asia/Bangkok`, viewport 1280×800 และ 1440×900
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #296 (เก็บ 14 วัน) · รูป 01–02 มาจาก fixture `evidence()` ของ e2e `evoucher-admin-pool-page` ส่วน 03–05 เป็นของ qa

| AC | Result | Evidence |
|----|--------|----------|
| AC-7 `/evouchers`: หัวตาราง pool ใช้ `heading`/`subHeading` ของ `DataTable`; ตาราง pool มีหน้าละ 20 แถว กด Next แล้ว URL มี `pools_offset=20` และ reload แล้วยังอยู่หน้าเดิม; คลิกแถวแล้วไปหน้า pool | pass | 03-evouchers-pools-list.png |
| AC-7 หน้า pool: ใช้ `LayoutComposer`, Header แสดงชื่อ pool พร้อมปุ่ม "All pools", ใช้ `SectionRow` แสดง Partner / Face value / How to use และหน้า `import-codes` ใช้ Header | pass | 01-codes-filter-delivered.png |
| AC-7 ตาราง Codes ของ pool ที่มี 60 code: หน้าแรก 50 แถว กด Next แล้ว URL มี `codes_offset=50` ได้ 10 แถว และ reload แล้วยังอยู่หน้าเดิม | pass | 01-codes-filter-delivered.png |
| AC-7 filter `delivered`: ได้ 5 แถวและทุกแถวเป็น delivered; เปลี่ยน filter จากหน้า 2 (available → delivered → void) แล้ว `codes_offset` ถูกลบ ไม่มีตารางว่าง และไม่มี request `offset≠0` ที่มี status ใหม่หลุดไป; reload แล้ว filter ยังอยู่ | pass | 04-codes-filter-void-empty.png |
| AC-7 Reveal ผ่าน `ActionMenu` (trigger `evoucher-code-row-actions`, หา menuitem "Reveal" ด้วย role + ชื่อ) แล้วเห็น `evoucher-revealed-code` | pass | 02-code-revealed.png |
| AC-7 กันกด Reveal ซ้ำ: ดับเบิลคลิกทั้ง menuitem และปุ่มยืนยันระหว่างรอ response ยิง request แค่ 1 ครั้ง และ menuitem ของแถวอื่นเป็น disabled; กด Cancel ที่ prompt ไม่ยิง request; Reveal รอบถัดไปหลังเสร็จยิงได้ตามปกติ (รวม 2 ครั้ง) | pass | ผล test `AC-7 Reveal` (1280 และ 1440) |
| AC-7 static: `pools-table.tsx`/`codes-table.tsx` import `DataTable` (และ `ActionMenu` ใน codes) จาก `@medusajs/dashboard/components`; ไม่มี `DataTablePaginationState`; ทั้งสองหน้าใช้ `LayoutComposer`; unit `medusa-ui` + `evoucher-query` ผ่าน 75/75 | pass | grep + jest |
| Import กันกดซ้ำ: ดับเบิลคลิก Import แล้วมี POST แค่ 1 ครั้ง ได้ "Imported 3 codes" และตารางมี 3 แถว | pass | ผล test `Import` |
| Regression: `evoucher-admin-pool-page`, `evoucher-admin-forms`, `evoucher-admin-resend` (2), `flash-sale-admin-save`, `flash-sale-admin-widget` | pass (6/6) | ผลรัน chromium |

## Negative / edge
| กรณี | ผลลัพธ์ |
|------|---------|
| pool ที่ไม่มี code | pass — แสดง empty state "No codes / Import a CSV to add codes." ไม่มีแถว (05-empty-pool.png) |
| filter `void` ไม่มีข้อมูล | pass — แสดง "No codes match the selected status." และมีปุ่ม Clear all |
| Reveal แล้ว backend ตอบ 500 | pass — มี toast ข้อความ error, drawer ไม่เปิด และ menuitem กลับมากดได้ |
| Reveal แล้ว network ล้ม | pass — มี toast "Failed to fetch" กดใหม่ได้ และเมื่อ network กลับมาก็ Reveal สำเร็จ |
| Import แล้ว backend ตอบ 500 หรือ network ล้ม | pass — มี toast error ไม่แสดงผล import ปุ่มกดได้อีก และ import ครั้งถัดไปสำเร็จ |
| `codes_offset=abc` | request ใช้ `offset=0` ได้ 50 แถว ไม่มี JS error **แต่** label แสดง "NaN of 2 pages" และปุ่ม Prev/Next ถูก disable ทั้งคู่ (ดู O-1) |
| `codes_offset=-50` | request ใช้ `offset=0` แต่ label แสดง "0 of 2 pages" และต้องกด Next 2 ครั้งจึงไปหน้า 2 (ครั้งแรกแค่ลบ param) |
| `codes_offset=12.5` | request ใช้ `offset=0` แสดง "1 of 2 pages" และกด Next ไป `offset=50` ได้ถูกต้อง |
| `codes_offset=99999999` | request ใช้ `offset=99999999` ได้ 0 แถว แสดง "2000000 of 2 pages" พร้อม empty state "No codes / Import a CSV to add codes." ทั้งที่ pool มี 60 code และกด Prev ถอยได้ทีละหน้าเท่านั้น (ดู O-2) |

## Defect
ไม่มี (ทุก AC และทุกข้อที่ brief ขอให้ตรวจผ่านหมด)

## Observation (ไม่ block)
- **O-1** `codes_offset` ที่ไม่ใช่ตัวเลข: `evoucher-query.ts` ป้องกันค่าที่ส่งไป API แล้ว แต่ `DataTable` ของ dashboard ยังอ่านค่าดิบจาก URL เอง จึงได้ label "NaN of 2 pages" และ Prev/Next ถูก disable ทั้งคู่ ผู้ใช้จะติดอยู่หน้าแรกจนกว่าจะแก้ URL เอง พฤติกรรมนี้มาจาก Medusa เพราะหน้า `/app/campaigns?offset=abc` ของ Medusa เองถึงขั้นแสดง error page ("Expected type: 'number' for field 'offset', got: 'NaN'") จะแก้ใน follow-up ก็ได้ เช่น normalize URL ทิ้งค่าที่ไม่ใช่จำนวนเต็มบวก (แบบที่ ADM-6 ทำกับ `gb_offset`)
- **O-2** offset เกินจำนวนจริง: Medusa เองก็แสดง label แบบเดียวกัน (campaigns แสดง "5000001 of 1 pages") ส่วนที่มาจากฝั่งเราคือข้อความ empty state "Import a CSV to add codes." ที่ชวนเข้าใจผิดเมื่อ pool มี code อยู่แล้ว เกิดได้เฉพาะเมื่อแก้ URL เอง
- **O-3** ทั้งสองข้อนี้เกิดเฉพาะเมื่อผู้ใช้แก้ URL เอง ไม่เกิดจากการกดปุ่มใน UI
- หมายเหตุสำหรับคนเขียน e2e: ใน prod build ระหว่างที่ popover ของ filter เปิดอยู่ ส่วนอื่นของหน้าถูกตั้งเป็น aria-hidden ต้องปิด popover ก่อน (กด Escape แล้วรอจนตัวเลือกหายไป) และเมื่อมี filter ค้างอยู่ ปุ่ม Funnel จะ disable ต้องเปลี่ยนค่าผ่าน chip แทน ทั้งสองข้อเป็นพฤติกรรมของ Medusa

## สรุป
AC-7 ผ่านครบทั้งสอง viewport (1280×800 และ 1440×900) บน prod build ฟีเจอร์กันกดซ้ำของ Reveal/Import และการ reset offset เมื่อเปลี่ยน filter ทำงานถูกต้อง regression 6/6 ผ่าน ไม่มี defect มีเพียง observation เรื่อง `codes_offset` ผิดรูปแบบที่ส่วนใหญ่มาจาก DataTable ของ Medusa
