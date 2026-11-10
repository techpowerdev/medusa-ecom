# รายงาน QA — ADM-20 สถานะ error ของรายการแคมเปญ group buy (PR #335)

Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 24, AC-24 · ADR-018
Commit: `c5ba7ca7` · backend prod build (`medusa build` + `medusa start`) · Chromium 1280×800, locale en-US, timezone Asia/Bangkok
ผลรวม: **PASS** (e2e ของ PR 12/12, QA spec 11/11, static jest 10/10) ไม่พบ defect

## Acceptance criteria
| AC | ผล | หลักฐาน |
|---|---|---|
| AC-24 (1) GET `**/admin/group-buy/campaigns*` ตอบ 500 → เห็น `gb-campaigns-error` อยู่ใน `gb-campaigns-table` หัวข้อ "Could not load campaigns" + `error.message` ไม่มี "No group-buy campaigns yet" ยังเห็น `gb-template-warning` ปุ่ม Create campaign (role + ชื่อภายใน `gb-campaigns-table`) enabled และเปิด modal ได้ | PASS | `01-error-500.png`, e2e PR #9, QA T1 |
| AC-24 (2) `route.abort()` → ผลเหมือนข้อ 1 (ข้อความ "Failed to fetch") | PASS | `02-error-abort.png`, e2e PR #10, QA T2 |
| AC-24 (3) ตอบ 401 → ไป `/app/login` | PASS | e2e PR #11, QA T3 (ไม่เห็น `gb-campaigns-error` ก่อน redirect) |
| AC-24 (4) ตอบ `{campaigns: [], count: 0}` → empty state เดิม ไม่มี `gb-campaigns-error` | PASS | `03-empty.png`, e2e PR #12, QA T4 |
| AC-24 (5) API ปกติ → ตาราง 20 แถว, Next แล้ว URL มี `gb_offset=20`, คลิกแถวแล้วไปหน้ารายละเอียด (AC-9/AC-14/AC-17 ผ่าน) | PASS | e2e PR #6–8, QA T5 |
| กฎ 24d: โหลดสำเร็จแล้ว refetch ล้ม → ตารางเดิมไม่หาย | PASS | `04-refetch-fail-keeps-table.png`, QA T6 |
| static: `page.tsx` มี `isError && !data` และ `"Could not load campaigns"` อยู่ใน `emptyState` ไม่มี `NoRecords` | PASS | jest `group-buy-pages.unit.spec.ts` 10/10 |
| ล้มบน develop ก่อนแก้ | ยืนยันแล้ว | ใช้ `page.tsx` ของ develop: test 500/abort/401 ล้ม test empty ผ่าน หน้าแสดง "No group-buy campaigns yet" ตอน 500 |

## Edge case
| กรณี | ผล |
|---|---|
| ระหว่างโหลดตอน 500 (dashboard ตั้ง `retry: 1` จึงมี GET 2 ครั้ง) ข้อความ empty ไม่เคยโผล่ใน DOM (ตรวจด้วย MutationObserver) | PASS |
| dblclick ปุ่ม Create campaign ขณะหน้าอยู่ในสถานะ error → modal เปิดครั้งเดียว (`gb-campaign-create-submit` count 1) | PASS |
| refetch ล้มหลังสร้างแคมเปญผ่านฟอร์มจริง (`invalidateQueries`, GET ล้ม 2 ครั้ง) → แถวเดิม 20 แถว แถวแรกไม่เปลี่ยน ไม่มี error | PASS |
| หน้า 1 ปกติ หน้า 2 (`offset=20`) ตอบ 500: กด Next หรือ deep link `?gb_offset=20` → แสดง error ไม่แสดง empty และ URL คง `gb_offset=20` | PASS |
| ตอบ 503 body เป็น text ที่ไม่ใช่ JSON → แสดง error พร้อมข้อความ "Service Unavailable" เลิก mock แล้ว reload → ตารางกลับมา | PASS |
| ตอบ 403 และ 404 → แสดง error ไม่ redirect ไป login | PASS |
| `message` ที่มี HTML (`<b id=...>`) → แสดงเป็นข้อความ ไม่ render เป็น element | PASS |
| สองแท็บ: แท็บ A ล้ม แท็บ B ปกติ → แท็บ B แสดงตาราง ไม่กระทบกัน | PASS |
| มือถือ 375×812 → เห็น error ปุ่มกดได้และเปิด modal ได้ | PASS (`05-mobile-error.png`) |
| ภาษา: ข้อความ error ไม่มีอักษรไทย (regex `[฀-๿]`) admin คงภาษาอังกฤษ | PASS |

## Defect
ไม่พบ

ข้อสังเกต (ไม่ใช่ defect): ตอนอยู่ในสถานะ error แถบแบ่งหน้าของ `DataTable` ยังแสดง "0 — 0 of 0 results / 1 of 1 pages" ซึ่งเป็นพฤติกรรมของ dashboard ที่ `rowCount=0` ตาม spec กฎ 24a ที่ให้คง `DataTable` ไว้

## Screenshot
- `01-error-500.png` — 500: แสดง "Could not load campaigns / An unknown error occurred." ยังมีคำเตือน GBT- และปุ่ม Create campaign
- `02-error-abort.png` — network ล้ม: "Failed to fetch"
- `03-empty.png` — รายการว่าง: empty state เดิม
- `04-refetch-fail-keeps-table.png` — refetch ล้มหลังสร้างแคมเปญ: ตารางเดิมยังอยู่ (toast "Campaign created as draft")
- `05-mobile-error.png` — 375px

## ไม่ได้ทดสอบ
- 401 ตอน refetch ขณะมี data (โค้ด throw ทุก 401 จึงควรไป login เหมือนกัน แต่ไม่ได้รันจริง)
- browser อื่นนอกจาก Chromium และไม่ได้ตรวจ a11y หรือ screen reader ของข้อความ error
- ตาราง/หน้าอื่น (ADM-21/ADM-22 อยู่นอกขอบเขต)
