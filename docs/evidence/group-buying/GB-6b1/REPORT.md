# QA GB-6b1 — หน้า admin รายละเอียดแคมเปญ group buying (PR #87)
ทดสอบที่ commit `4f71b0e` (head `0f1488e` ต่างแค่ข้อความ prompt Delete, evidence-rules และเอกสาร ไม่กระทบ logic UI)
Playwright (chromium) กับ backend production build; report/trace ฉบับเต็มอยู่ใน CI artifact

| # | Checklist | ผล | หลักฐาน |
|---|-----------|----|---------|
| 1 | คลิกแถวในหน้ารายการ `/app/group-buying` แล้วเข้าหน้ารายละเอียด | ผ่าน | `01-row-click-detail.png` |
| 2 | draft: Delete→Cancel ไม่มี mutation request; Activate→ยืนยัน: badge `active`, เห็น End, Activate/Delete หาย, POST status 1 ครั้ง | ผ่าน | `02-draft-activated.png` |
| 3 | `gb-create-pool-group`: dblclick → POST 1 ครั้ง; คลิก 5 ครั้งใน JS task เดียว → POST 1 ครั้ง; แคมเปญ team ไม่มีปุ่ม | ผ่าน | `03-pool-group-dblclick-5clicks.png` |
| 4 | แคมเปญ ended ไม่มีปุ่ม activate/end/delete/create-pool | ผ่าน | `04-ended-no-actions.png` |
| 5 | ลบ draft แล้วกลับหน้ารายการ ไม่มี error | บางส่วน (D-1) | `05-deleted-back-to-list.png` |
| 6 | ข้อความ admin เป็นอังกฤษ | ผ่าน | ตรวจในข้อ 1–5 |

## Negative / edge case
| กรณี | ผล |
|------|----|
| End แคมเปญ active ผ่าน UI → ended และปุ่มหายทั้งหมด, POST 1 ครั้ง | ผ่าน |
| ปิด prompt Activate ด้วย Escape → ไม่มี request และกดปุ่มซ้ำได้อีก | ผ่าน |
| dblclick ปุ่ม Activate และปุ่มยืนยันใน dialog → POST status 1 ครั้ง | ผ่าน |
| API: DELETE active/ended → 400; สร้าง pool บน team → 403, บน draft/ended → 400; ended→active → 400 | ผ่าน |
| เปิด `/app/group-buying/<id ที่ไม่มีอยู่>` | ไม่ผ่าน (D-2) |

## Defects
- D-1 (minor): ลบ draft แล้วยังยิง `GET /admin/group-buy/campaigns/:id` ซ้ำได้ 404 และมี error ใน console (toast และหน้ารายการแสดงถูกต้อง) → แก้ใน PR นี้
- D-2 (minor): id แคมเปญที่ไม่มีอยู่ทำให้หน้าค้าง "Loading..." ไม่แสดง error/not found → แก้ใน PR นี้

## หลังแก้ D-1 / D-2 (commit `6cc4de9`)
- D-1: ตัด `removeQueries` ออก — e2e ของ PR นับ GET แคมเปญ = 0 และไม่มี console error หลังลบ (ล้มก่อนแก้: ได้ 1)
- D-2: แสดง `gb-campaign-not-found` เมื่อ 404 (error อื่นแสดง "Could not load the campaign") — e2e เปิด id ที่ไม่มีแล้วเห็นข้อความ (ล้มก่อนแก้)
- reviewer ตรวจรอบแก้แล้ว (APPROVE) และ CI รัน e2e ของทั้งสองกรณี
