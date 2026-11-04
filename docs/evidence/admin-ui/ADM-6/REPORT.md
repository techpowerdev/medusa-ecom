# QA ADM-6 — หน้า admin group buy (spec 08 AC-9)

PR #293 · รอบ 1 head `8663316` · รอบ 2 (หลังแก้ตาม review) head `b10b05b` · prod build (`medusa build` + `medusa start`) · chromium · en-US / Asia/Bangkok · viewport 1280×800 และ 1440×900
report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #293 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-9 breadcrumb ของหน้ารายละเอียดเป็น "Group buying › <ชื่อแคมเปญ>" (ชื่อมาจาก `loader`) | pass | ac9-detail-breadcrumb-1440x900.png; รอบ 2: e2e `group-buy-admin-pages` ผ่าน; ทั้ง 2 viewport ได้ `["Group buying","<ชื่อแคมเปญ>"]` กด "Group buying" (`href=/app/group-buying`) แล้วกลับหน้ารายการ; เปิดตรงจาก URL ได้ และ back/forward ระหว่างแคมเปญ A/B ชื่อเปลี่ยนตาม; ที่ 900px (< lg) รายการสุดท้ายย่อเป็น "..." ตามดีไซน์ของ dashboard |
| AC-9 รายการเป็น `DataTable` และคลิกแถวแล้วไป `/group-buying/:id` | pass | ac9-list-1280x800.png; e2e ผ่าน; Meta-click บนแถวเปิดแท็บใหม่ที่ `/app/group-buying/gbcamp_…` (พฤติกรรม `rowHref` ของ dashboard); รอบ 2: คลิกแถวในหน้า 2 แล้วไปหน้ารายละเอียด และ back แล้วกลับมาที่ `gb_offset=20` |
| AC-9 หน้า 2 อยู่ใน URL (`gb_offset=20`) และ reload แล้วยังอยู่หน้าเดิม | pass | ac9-list-page2-1440x900.png; กด Next ได้ `gb_offset=20` และ reload แล้วแถวแรกยังเป็นของหน้า 2; กด Prev แล้ว param หายและกลับหน้า 1; รอบ 2: reload `gb_offset=20` แล้วแถวแรกยังเป็นแถวเดิม ("2 of 2 pages") |
| AC-9 ฟิลด์รายละเอียดใช้ `SectionRow` (static) | pass | unit `group-buy-pages.unit.spec.ts` กับ `medusa-ui.unit.spec.ts` ผ่าน 57/57 (รอบ 1); `gb-campaign-row-*` ยังมี testid เดิม |
| AC-9 id ที่ไม่มีจริงขึ้น `gb-campaign-not-found` | pass | ac9-not-found-1280x800.png; แสดงเป็น `NoRecords` breadcrumb เป็น "Group buying › Campaign" (รอบ 2) ปุ่ม "Back to group-buy campaigns" กลับไป `/app/group-buying` ได้ |
| AC-9 e2e `group-buy-admin-*` ผ่านโดยไม่แก้ | pass | รอบ 1 และรอบ 2 ผ่าน 15/15 (dates, detail, form, members, pages); รอบ 2 รัน `group-buy-admin-pages` เดี่ยวบน DB ว่าง (0 แคมเปญ) ก็ผ่าน; ไฟล์ใน `apps/storefront/e2e` ที่เปลี่ยนมีแค่ไฟล์ใหม่ `group-buy-admin-pages.spec.ts` |
| `groups-section` มี Header และกันกดซ้ำ | pass | ac9-groups-guard-1280x800.png (ผลอยู่ในหัวข้อ negative/edge ด้านล่าง) |

## Negative / edge
| กรณี | ผล |
|------|----|
| Activate: dblclick และกด 3 ครั้งใน tick เดียว (`el.click()` ×3) | กล่องยืนยันขึ้น 1 กล่อง กด Cancel แล้วไม่มี POST; เมื่อยืนยันมี `POST …/status` 1 ครั้ง |
| Create pool group: กด 3 ครั้งใน tick เดียว | `POST …/groups` 1 ครั้ง ได้ 1 กลุ่ม; หลังสร้างเสร็จกดอีกครั้งได้ (guard ปล่อยแล้ว) ได้ 2 กลุ่ม |
| `gb-group-succeed` + `gb-group-fail` ใน tick เดียว | กล่องยืนยันขึ้นกล่องเดียว (succeed) กด Cancel แล้วมี 0 POST; dblclick fail แล้วยืนยันมี 1 POST แล้วปุ่มหาย |
| API ยิง succeed + fail พร้อมกันบนกลุ่มเดียว | 200 / 400 สถานะสุดท้ายเป็น `succeeded` (ผ่านได้ทางเดียว) |
| GET แคมเปญตอบ 500 (mock) | ขึ้น "Could not load the campaign" ไม่มี `gb-campaign-not-found` breadcrumb เป็น "Campaign" |
| `gb_offset=25` | ได้ 200 แสดงแถวที่ 26–45 ส่วน pagination บอก "2 of 2" (ปัดหน้าแบบ dashboard) |
| `gb_offset=abc` (รอบ 2) | API ได้ `offset=0` ตอบ 200 แสดงหน้า 1 ("20 of 27 results \| 1 of 2 pages") ไม่มีคำว่า NaN param หายจาก URL (`replace`) history ไม่เพิ่ม กด back แล้วไปหน้าก่อนหน้า ไม่วนกลับ URL ผิด (รอบ 1 ได้ 400 และ "NaN of 0 results" ซึ่งแก้แล้ว) |
| `gb_offset=-5` และ `Infinity` (รอบ 2) | ได้หน้า 1 ตอบ 200 param หายจาก URL ไม่มี NaN และ history ไม่เพิ่ม (รอบ 1 `-20` ได้ 500 ซึ่งแก้แล้ว) |
| `gb_offset=20.5` (รอบ 2) | URL ถูกแก้เป็น `gb_offset=20` แสดงหน้า 2 ตอบ 200 history ไม่เพิ่ม |
| `gb_offset=` ค่าว่าง (รอบ 2) | ได้หน้า 1 ตอบ 200 ไม่มี NaN แต่ `gb_offset=` ยังค้างใน URL (ไม่มีผลต่อการแสดงผล) |
| `gb_offset=1e1` (รอบ 2) | `Number` ตีความเป็น 10 → URL `gb_offset=10` แสดงแถวที่ 11–27 และ pagination "1 of 2 pages" (offset ไม่ลงตัวกับหน้า แบบเดียวกับ `25`) |
| `gb_offset=99999` | ได้ 200 ตารางว่าง "5000 of 2 pages" |
| ไม่มี scroll แนวนอน (1280×800, 1440×900 และ 900×800 ในรอบ 2) ทั้งหน้ารายการและหน้ารายละเอียด | pass |

## Defect
ไม่พบ defect ของ PR นี้ (ทั้งสองรอบ)

## Observation (ดูด้วยตา และประเมินผลต่อผู้ใช้)
1. **แถว toolbar ว่างเหนือตาราง** (รอบ 2 ยังเหมือนเดิม): เป็นแถบว่างสูง 32px คั่นระหว่างข้อความเตือนสีแดงกับหัวตาราง ไม่มีปุ่มหรือข้อความในแถบ เห็นทั้งสอง viewport ผลต่อผู้ใช้ต่ำ ดูเหมือนมีช่องว่างเกินมาเท่านั้น ไม่กระทบการใช้งาน
2. **breadcrumb มีรายการเดียว**: แก้แล้วในรอบ 2 ตอนนี้เป็น "Group buying › <ชื่อแคมเปญ>" กด "Group buying" ได้ และหน้ารายการเองก็มี breadcrumb "Group buying" แล้ว
3. **badge สถานะย้ายไปฝั่งขวา** ไปอยู่หน้าปุ่ม Activate/Delete (เดิมอยู่ติดกับชื่อแคมเปญ) ยังอ่านง่าย
4. **loader ทำให้หน้าเปลี่ยนช้าขึ้นและยิง GET ซ้ำ** (รอบ 2 ยังเหมือนเดิม): เปิดหน้ารายละเอียดตรงๆ มี GET แคมเปญ 5 ครั้ง (หน้า pool ของ ADM-4 ก็ 5 ครั้ง ส่วนหน้า product ของ core มี 1 ครั้ง) เมื่อคลิกแถวโดยหน่วง GET ไว้ 2 วินาที URL จะยังไม่เปลี่ยนจนถึง 2.0 วินาที (router รอ loader) และหน้าพร้อมที่ 4.4 วินาที เพราะ loader กับ `useQuery` โหลดต่อกัน ผลคือ latency ในการเปิดหน้ารายละเอียดเป็นสองเท่า สถานะ "Loading..." ของหน้าจึงแทบไม่ปรากฏ ผลต่อผู้ใช้ต่ำในเครื่อง แต่จะรู้สึกได้เมื่อเครือข่ายช้า ตรงกับงานต่อเนื่องที่ PR ระบุไว้ (seed cache จาก loader)
5. **`gb_offset=` ค่าว่างค้างใน URL** (รอบ 2): หน้าแสดงถูกต้อง (หน้า 1) แต่ param ว่างไม่ถูกลบ เพราะ `useQueryParams` คืน `undefined` จึงไม่เข้าเงื่อนไขแก้ URL ผลต่อผู้ใช้ไม่มี

## สรุป
AC-9 ผ่านครบทุกข้อทั้งสองรอบ รอบ 2 (`b10b05b`) breadcrumb เป็น 2 ระดับและกดกลับหน้ารายการได้ `gb_offset` ที่ผิดรูปไม่ทำให้เกิด 400/500 หรือ NaN อีก และแก้ URL โดยไม่เพิ่ม history regression `group-buy-admin-*` ผ่าน 15/15 และ e2e `pages` ผ่านบน DB ว่าง ไม่มี defect ส่วน observation ที่เหลือ (ข้อ 1, 3, 4, 5) เป็นงาน UX หรือ performance ที่ไม่ขวางการ merge
