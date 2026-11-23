# QA GB-27 — ซ่อนนับถอยหลังเมื่อแคมเปญยังไม่เริ่ม (PR #506)

- Spec: `docs/spec/04-group-buying.md` กฎข้อ 52, AC-70
- Commit ที่ตรวจ: `eacc3e8f85e34673d643ca1eb28c049ad80b41be` (branch `feat/GB-27-hide-countdown-before-start`)
- สภาพแวดล้อม: worktree แยก, prod build — backend `NODE_ENV=production medusa build` + `medusa start` (จาก `.medusa/server`) :9256,
  storefront `next build` + `next start` :8256, DB `medusa_qa506` (seed ใหม่), Redis db 11, Chromium (Playwright)
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #506 (ไม่เก็บใน git)

## ผลต่อ AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-70 (a) แคมเปญ `starts_at` อนาคต → ไม่มี `group-countdown`, มี `group-starts-at` ภาษาไทย (เวลาไทยตรง), ไม่มี `group-join`/`group-join-button`/`group-create-team-button` | pass | qa506-ac70-not-started-desktop.png |
| AC-70 (b) แคมเปญเริ่มแล้ว → มี `group-countdown` ("เหลือเวลา"), ไม่มี `group-starts-at`, มีปุ่ม join | pass | qa506-ac70-started-desktop.png |
| checklist 3: กลุ่ม `succeeded`/`failed` → ไม่มีนับถอยหลัง (ทั้งแคมเปญเริ่มแล้วและเลื่อน `starts_at` ไปอนาคต) | pass | qa506-ac70-succeeded.png |
| checklist 4: 375px ไม่เลื่อนแนวนอน (scrollWidth ≤ clientWidth) ทั้งสถานะเริ่มแล้วและยังไม่เริ่ม | pass | qa506-ac70-not-started-375.png |

e2e ของ PR: `group-buy-not-started.spec.ts` + `group-buy-group-page.spec.ts` 7/7 ผ่าน (AC-70 a/b, AC-66 a/b, AC-16a regression 3 เคส)
unit: `src/lib/util/group-page.test.ts` 21/21 ผ่าน (รวม `groupShowCountdown` 3 เคส)
สคริปต์ของ qa (ไม่ commit): 10/10 ผ่าน

## Negative / edge case

| กรณี | ผล | หมายเหตุ |
|------|----|----------|
| เปิดหน้าค้างข้ามเวลาเริ่ม (`starts_at` = now+12s, รอ 20s) | pass | หน้าไม่พัง ไม่มี pageerror/console error, ยังแสดง `group-starts-at` ไม่มี countdown (ไม่ auto-refresh ตามกฎข้อ 52); reload แล้วมี `group-countdown` + ปุ่ม join และไม่มี `group-starts-at` |
| timezone เครื่อง America/New_York (locale en-US) | pass | `group-starts-at` เป็นเวลาไทย (`th-TH`, Asia/Bangkok) ตรงกับค่าที่คำนวณ ช่วงที่วันต่างกันระหว่าง NY/ไทย, ไม่มี hydration error; แคมเปญเริ่มแล้วมี countdown — qa506-edge-tz-new-york.png |
| ข้อความภาษาไทย (regex อักษรไทย + ไม่มีคำละติน) | pass | `expectThai(["group-starts-at"])` |
| `starts_at` ผ่านไปแล้ว 1 นาที (ขอบ) | pass | มี countdown ไม่มี `group-starts-at` |
| `starts_at` = NULL | pass | มี countdown (ถือว่าเริ่มแล้ว) |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ผิด spec)
- หน้าแคมเปญที่ยังไม่เริ่มยังแสดงลิงก์แชร์ + ปุ่ม "คัดลอกลิงก์" (พฤติกรรมเดิมของ GB-24; กฎข้อ 49 ไม่ได้สั่งซ่อน)
