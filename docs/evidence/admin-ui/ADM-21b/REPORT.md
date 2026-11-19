# รายงาน QA — ADM-21b สถานะ error ของตาราง affiliate ทุกแท็บ และ group buy groups/members (PR #362)

Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 24a–d + 25, AC-26 (regression AC-11, AC-13, AC-21, AC-24) · ADR-018
Commit: `1d4131e3` · backend prod build (`medusa build` + `medusa start` จาก `.medusa/server`, `NODE_ENV=production`) · Chromium 1280×800, locale en-US, timezone Asia/Bangkok
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/43418374590 (Playwright report + trace ฉบับเต็มเป็น artifact ของ run นี้ 14 วัน)
ผลรวม: **PASS** — e2e ของ PR 28/28, regression admin 29/29, QA spec 7/7, static jest 180/180 ไม่พบ defect

## Acceptance criteria
| AC | ผล | หลักฐาน |
|---|---|---|
| AC-26 affiliate: GET ของแต่ละแท็บ (`programs`, `affiliates`, `entries`, `payouts`) ตอบ 500 → `affiliate-list-error` visible หัวข้อ "Could not load <resource>" heading ของแท็บยังอยู่ ไม่มีข้อความ empty เดิม ปุ่ม "Create program"/"Create payout" (role + ชื่อภายใน `affiliate-programs-table`/`affiliate-payouts-table`) enabled | PASS | `02-payouts-error-500.png`, e2e PR 4 test |
| AC-26 affiliate: `route.abort()` ทุกแท็บ → ผลเหมือน 500 | PASS | e2e PR 4 test |
| AC-26 affiliate: GET payouts ตอบ 401 → ไป `/app/login` | PASS | e2e PR |
| AC-26 affiliate: ทุกแท็บตอบรายการว่าง → empty state เดิม และ `affiliate-list-error` count 0 | PASS | e2e PR |
| AC-26 groups: GET groups ตอบ 500 / abort → `gb-groups-error` อยู่ใน `gb-groups-table` "Could not load groups" ไม่มี "No groups yet" `gb-create-pool-group` enabled | PASS | `03-groups-error-500.png`, e2e PR 2 test |
| AC-26 members: เลือกกลุ่มแล้ว GET memberships ตอบ 500 / abort → `gb-memberships-error` อยู่ใน `gb-memberships-table` "Could not load members" ไม่มี "No members yet" | PASS | `04-members-error-500.png`, e2e PR 2 test |
| AC-26 groups/members: 401 → ไป `/app/login` | PASS | e2e PR 2 test |
| AC-26 groups/members: รายการว่าง → empty state เดิม ไม่มี testid error | PASS | e2e PR |
| กฎ 24d groups: Create pool group แล้ว refetch ล้ม → แถวเดิมคงอยู่ | PASS | `05-groups-refetch-fail-keeps-rows.png`, e2e PR |
| กฎ 24d affiliate ทุกแท็บ (ยังไม่มี e2e อัตโนมัติใน PR): โหลดสำเร็จแล้ว refetch ล้ม → ตารางเดิมคงอยู่ ไม่มี `affiliate-list-error` | PASS | QA Q2 (Programs: Delete draft ที่ DELETE ถูกบังคับตอบ 409 → invalidate → GET ล้ม 2 ครั้ง แถวยังอยู่), QA Q3 (ทั้ง 4 แท็บ: cache เกิน staleTime 90 วิด้วย `page.clock` แล้วกลับเข้าแท็บ → refetch ล้ม 2 ครั้งต่อแท็บ จำนวนแถวเท่าเดิม 11/15/20/20) |
| กฎ 24d members (ยังไม่มี e2e อัตโนมัติใน PR): สมาชิกจริง 1 คน กด Mark failed (POST ถูกบังคับตอบ 409) → `onSettled` invalidate → GET memberships และ groups ล้ม 2 ครั้ง → แถวสมาชิกและแถวกลุ่มคงอยู่ ไม่มี testid error | PASS | `06-members-refetch-fail-keeps-rows.png`, QA Q4 |
| static: `list-table.tsx`, `groups-section.tsx`, `group-members.tsx` มี `isError && !data` heading error อยู่ใน `emptyState` และ 401 → `throw` ผ่าน `isUnauthorized` | PASS | jest `medusa-ui.unit.spec.ts` 180/180 |
| ล้มบน develop ก่อนแก้ | ยืนยันแล้ว | build ใหม่ด้วยสามไฟล์ component ของ `origin/develop`: test ADM-21b ล้ม 15 (500/abort/401 ทุกตาราง) ผ่าน 3 (รายการว่าง 2 + กฎ 24d groups ซึ่งคาดว่าผ่านบน develop อยู่แล้ว) |

## Regression
| รายการ | ผล | หลักฐาน |
|---|---|---|
| AC-21 / ADM-17 ฟอร์ม payout: combobox ค้น affiliate รายที่ 250 ด้วย `q`, GET รายชื่อล้ม → error ใต้ช่อง | PASS | `affiliate-admin-forms` (AC-12/AC-21 4 test), `affiliate-admin-payout-create` |
| AC-11 แบ่งหน้าแท็บ affiliate + ตาราง/ชื่อ affiliate | PASS | `affiliate-admin-tables`, `affiliate-admin-names`, `affiliate-admin-payouts`, `affiliate-admin-programs`, `affiliate-admin-affiliates` |
| AC-13 row action (Approve ฯลฯ) | PASS | `affiliate-admin-row-actions` 3 test |
| AC-24 / ADM-20 หน้า `/app/group-buying` (500/abort/401/ว่าง) และ AC-9/AC-14 | PASS | `group-buy-admin-pages` 6 test |
| หน้ารายละเอียด/สมาชิก/ฟอร์ม group buy, ปุ่มสร้างใน `action` | PASS | `group-buy-admin-{detail,members,form,dates}`, `admin-list-create-action` |

## Edge case (QA spec ไม่อยู่ใน PR)
| กรณี | ผล |
|---|---|
| สลับแท็บ: Programs ล้ม → Affiliates/Ledger/Payouts ไม่มี `affiliate-list-error` และไม่มีข้อความ "Could not load" ค้าง; กลับมา Programs ยังแสดง error 1 อัน (Q1) | PASS |
| Payouts ล้ม → กลับ Programs (ปกติ) ไม่มี error; เลิก mock + reload → Payouts แสดงตารางปกติ (Q1b) | PASS |
| Payouts 25 แถว หน้า 1 ปกติ หน้า 2 (`offset=20`) ตอบ 500 → แสดง error ไม่แสดง "No payouts yet" URL คง `payouts_offset=20` (Q5) | PASS |
| 503 body เป็น text → "Could not load programs / Service Unavailable"; ระหว่างโหลด "No programs yet" ไม่เคยโผล่ใน DOM (MutationObserver); ข้อความ error ไม่มีอักษรไทย (Q6) | PASS |
| dblclick "Create program" ขณะอยู่ในสถานะ error → modal เปิดครั้งเดียว (`affiliate-program-save` count 1) (Q6) | PASS |
| `message` ที่มี HTML (`<b id=...>`) → แสดงเป็นข้อความ ไม่ render เป็น element (Q6) | PASS |
| 401 ตอน refetch members ขณะมี data → ไป `/app/login` (Q4) | PASS |

## Defect
ไม่พบ

ข้อสังเกต (ไม่ใช่ defect): ในสถานะ error แถบแบ่งหน้ายังแสดง "0 — 0 of 0 results" เป็นพฤติกรรมของ `DataTable` ที่ `rowCount=0` ตามกฎ 24a ที่ให้คงตาราง (เหมือน ADM-20)

## Screenshot (5 รูป)
- `02-payouts-error-500.png` — แท็บ Payouts ตอบ 500: "Could not load payouts" ปุ่ม Create payout ยังอยู่
- `03-groups-error-500.png` — Groups ตอบ 500: "Could not load groups" ปุ่ม Create pool group ยังอยู่
- `04-members-error-500.png` — Members ตอบ 500: "Could not load members"
- `05-groups-refetch-fail-keeps-rows.png` — กฎ 24d groups: refetch ล้ม แถวเดิมยังอยู่
- `06-members-refetch-fail-keeps-rows.png` — กฎ 24d members (QA): Mark failed ถูกบังคับตอบ 409 แล้ว refetch ล้ม แถวสมาชิกยังอยู่ (toast "QA forced conflict")

`01-programs-error-500.png` ถูกแทนด้วย `06` เพื่อคงเพดาน 5 รูป: `02` แสดงสถานะ error ของ `AffiliateListTable` ตัวเดียวกันพร้อมปุ่มสร้างใน `action` อยู่แล้ว ส่วน 24d ของ members ยังไม่มี e2e อัตโนมัติจึงต้องการภาพยืนยัน

## ไม่ได้ทดสอบ
- browser อื่นนอกจาก Chromium, มือถือ, a11y ของข้อความ error
- 401 ตอน refetch ของแท็บ affiliate และ groups (โค้ด throw ทุก 401 เหมือน members ที่รันแล้ว)
- QA spec ไม่ได้ commit — กฎ 24d ของ affiliate/members ยังไม่มี e2e อัตโนมัติใน repo
