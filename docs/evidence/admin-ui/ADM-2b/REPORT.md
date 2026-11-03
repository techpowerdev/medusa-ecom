# Evidence: ADM-2b — วันที่ใน admin ใช้ `useDate` + ปุ่ม admin กันกดซ้ำด้วย `createSingleFlight` (QA PR #225)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` — AC-3, AC-4 · ADR-018
- PR: #225 — branch `feat/ADM-2b-admin-medusa-components` @d5fbe76
- สภาพแวดล้อม: prod-like (`medusa build` + `medusa start`), node 24.12.0, Playwright chromium `locale: "en-US"` + `timezoneId: "Asia/Bangkok"` (`ADMIN_UI_OPTIONS`); admin ภาษาอังกฤษ; ไม่ใช้ Stripe
- ผล: e2e ของ PR 14/14; unit static `medusa-ui.unit.spec.ts` 49/49 + `admin-options.unit.spec.ts` 15/15; spec ของ qa 5/5
- รายงาน/trace ฉบับเต็ม: CI artifact ของ job e2e (14 วัน)

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-3 `ends_at` `2026-01-31T17:30Z` → `/group-buying/:id` แสดง `Feb 1, 2026` + `12:30 AM` (`group-buy-admin-dates`) | pass | `ac3-01-campaign-ends-at-bangkok.png` |
| AC-3 (QA-2) รายการแคมเปญ Ends, ตาราง groups Ends, members Joined ตรงกับเวลาไทยที่คำนวณด้วย Intl | pass | `ac3-02-campaign-list-ends.png` |
| AC-3 (QA-3) Expires ใน widget E-vouchers ของ order (`2027-01-31T17:30Z` → `Feb 1, 2027`) | pass | `ac3-03-order-evouchers-expires.png` |
| AC-3 (QA-3) Expires ใน `codes-table` และใน drawer Reveal (`Expires Feb 1, 2027 ·`) | pass | `ac3-04-reveal-drawer-expires.png` |
| AC-3 static: `lib/evoucher.ts`/`lib/group-buy.ts` ไม่มี formatter, ผู้เรียกใช้ `useDate`, e2e admin ทุกไฟล์ใช้ `ADMIN_UI_OPTIONS` | pass | unit 49/49, 15/15 |
| AC-4 e2e เดิม (`flash-sale-admin-save`, `evoucher-admin-resend`, `evoucher-admin-forms`, `group-buy-admin-detail`, `group-buy-admin-members`) dblclick Save/Resend/Succeed → request 1 ครั้ง | pass | 13/13 |
| AC-4 (QA-4/QA-5) dblclick Activate/End/Delete และ Mark failed → prompt เดียว, Cancel แล้วไม่มี request, กดใหม่ได้, dblclick ปุ่มยืนยัน → request 1 ครั้ง | pass | `ac4-05-group-fail-single-request.png` |
| AC-4 static: ไม่มี `useRef(false)` นอก `AC4_EXCEPTIONS`, 4 ไฟล์ใช้ `useState(createSingleFlight)` | pass | unit 49/49 |

## Negative / edge
| กรณี | ผล |
|------|----|
| `starts_at = null` → แถว Starts แสดง `-` ไม่มี pageerror | pass |
| code ไม่มี `expires_at` → `-` ใน widget order, `codes-table` และ drawer Reveal | pass |
| ยกเลิก prompt (Activate/End/Delete/Fail) แล้วกดใหม่ได้ | pass |
| dblclick ปุ่มยืนยันใน prompt → POST/DELETE 1 ครั้ง | pass |
| control: รัน QA-1/QA-3 ด้วย `timezoneId: "UTC"` → fail (`Jun 30, 2026 5:00 PM`, `Jan 31, 2027`) — ยืนยันว่าวันที่ตาม timezone ของ browser | ตามคาด (fail) |

Defect: ไม่พบ

## ข้อสังเกต
1. ปุ่ม Reveal ใน `codes-table` ยังไม่มี `data-testid` และยังไม่ใช่ ActionMenu (งานของ ADM-4) — qa หาด้วย role + ชื่อ
2. Expires ใน widget order และ `codes-table` แสดงเฉพาะวันที่ (ไม่มี `includeTime`) ตรงกับพฤติกรรมเดิม
