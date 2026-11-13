# QA ADM-19 — PR #380 (`partners_offset` ผิดรูปตอนไม่มี partner, กฎ 23)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 23, AC-23 (แถว ADM-19) · ADR-018 (ปุ่มใน `action` ของ `DataTable` หาด้วย role + ชื่อภายใน wrapper)
- Commit ที่ตรวจ: `1b74675cde4c784842a905068138d3e680b20929` (head ของ `feat/ADM-19-partners-bad-offset-empty`) ซึ่ง sync กับ develop แล้ว: `origin/develop` = `48bcf6f9` (Merge #373 ADM-23) เป็น ancestor ของ head (`git merge-base --is-ancestor` ผ่าน) → ปิดข้อสังเกตของ REPORT ADM-14 ที่ตรวจก่อน sync
- สภาพแวดล้อม: prod build (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, NODE_ENV=production) port 9318 · DB `medusa_qa380` (สร้างใหม่ + migrate + seed + admin user) · Redis db 8 · node v22.23.3 · chromium 1280×800, `locale: en-US`, `timezoneId: Asia/Bangkok` · admin เป็นภาษาอังกฤษ · Stripe key ปลอม (หน้า admin ไม่เรียก Stripe)
- ตรวจว่าไม่ reload: ตัวนับ document load ใน `sessionStorage` (`addInitScript`) ทุก case ต้องได้ 1 load หลัง `goto`
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #380 (14 วัน)

## ตาราง AC

| AC / รายการ | Result | Evidence |
|---|---|---|
| AC-23 e2e ของ PR: mock GET partners ว่าง + `?partners_offset=abc` → URL ไม่มี param, ปุ่ม "Create partner" 1 ตัวใน `evoucher-partners-table`, `evoucher-partners-empty` visible, ไม่มี `/NaN/`, กดปุ่มแล้ว modal เปิด | pass | `01-partners-bad-offset-empty.png`, `02-partners-bad-offset-create-modal.png` (builder) |
| AC-23 e2e ของ PR: แบบเดียวกันด้วย `-50` | pass | ผล test |
| AC-23 `--repeat-each=5` (2 test × 5) | pass 10/10 | ผล test |
| AC-23 REPORT ระบุ commit ที่ sync develop แล้ว | pass | หัวรายงานนี้ |
| AC-23 REPORT รวมผล gate × action ของ Partners/Programs/Payouts | pass | ตารางด้านล่าง, `03-qa-programs-bad-offset-1e1-mock.png`, `04-qa-payouts-bad-offset-12-5-mock.png`, `05-qa-partners-real-bad-offset-page1.png` |
| regression: `evoucher-admin-forms` + `evoucher-admin-partners` + `admin-list-create-action` (AC-8, AC-18, AC-20, AC-23, AC-25, AC-28) | pass 17/17 | ผล test |

## gate × action (`PageOffsetGate` + ปุ่มใน `action` ของ `DataTable`)

ทุกช่องตรวจ: URL ถูกแก้แบบ replace จน `<prefix>_offset` หายไป · ปุ่มสร้างใน wrapper กลับมา 1 ตัว (role + ชื่อ) และกดได้ · ไม่มี `NaN` · ไม่ reload · กดปุ่มแล้ว modal เปิด

| ตาราง (prefix) | ข้อมูล | `abc` | `-50` | `1e1` | `12.5` |
|---|---|---|---|---|---|
| Partners (`partners`) | mock ว่าง: empty state + "0 of 0 results" | pass | pass | pass | pass |
| Programs (`programs`) | mock ว่าง: "No programs yet" + "0 of 0 results" | pass | pass | pass (03) | pass |
| Payouts (`payouts`) | mock ว่าง: "No payouts yet" + "0 of 0 results" | pass | pass | pass | pass (04) |
| Partners | ข้อมูลจริง ว่าง | pass | pass | pass | pass |
| Programs | ข้อมูลจริง ว่าง | pass | pass | pass | pass |
| Payouts | ข้อมูลจริง ว่าง | pass | pass | pass | pass |
| Partners | ข้อมูลจริง 21 ราย: หน้า 1 มี 20 แถว, "20 of 21 results", "1 of 2 pages", Next ได้ `partners_offset=20` 1 แถว ปุ่มยังอยู่ | pass | pass (05) | pass | pass |
| Programs | ข้อมูลจริง 1 program: แสดงแถว, "1 of 1 pages" | pass | pass | pass | pass |

`1e1` และ `12.5` ถือว่าผิดรูป จึงกลับหน้าแรก ไม่ตีความเป็น offset 10 หรือ 12

## Negative / edge (pass ทั้งหมด)
- `partners_offset=` ค่าว่าง, `Infinity`, `" 20"` (ขึ้นต้นด้วยช่องว่าง), `0x14` → param ถูกลบ ปุ่มกลับมา ไม่ reload
- `partners_offset=400` (ถูกรูปแต่เกินช่วง มี 21 ราย) → clamp เป็น `20` เห็น 1 แถว
- เปิด `/app/evouchers` แล้วไป `?partners_offset=abc` → หลังแก้ URL กด Back ไม่กลับไป `?partners_offset=abc` (replace ไม่เพิ่ม history)
- `/app/affiliate?programs_offset=abc&payouts_offset=-50` → แท็บ Programs แก้เฉพาะ `programs_offset`; `payouts_offset=-50` คงอยู่จนเปิดแท็บ Payouts แล้วจึงถูกลบ ปุ่ม Create payout 1 ตัว
- หลัง gate เปิด dblclick ปุ่ม "Create partner" → dialog 1 ตัว

## Defect
ไม่พบ bug ของแอป

## ข้อสังเกต (ไม่ใช่ defect)
1. e2e ของ PR ครอบเฉพาะ Partners กับ `abc`/`-50` ตาม AC-23 ส่วน Programs/Payouts และ `1e1`/`12.5` ตรวจโดย QA ในรายงานนี้เท่านั้น ยังไม่มี regression guard ใน CI (follow-up ได้)
2. แท็บที่ไม่ active ของหน้า Affiliate (เช่น Payouts) ไม่ mount จึงไม่แก้ `payouts_offset` จนกว่าจะเปิดแท็บนั้น — ถูกต้อง (param ค้างใน URL แต่ไม่มีผล)
3. ข้อความแบ่งหน้าของ `DataTable` ใน textContent เป็น "1" + "20 of 21 results" ใน element แยก — test ที่ match ควรใช้ "20 of 21 results" หรือ "1 of 2 pages"
4. ข้อสังเกตใน PR body (mutation "ข้ามการแก้ URL เมื่อ `count === 0`" แล้ว test ไม่จับ) ยืนยันจากโค้ดได้: `usePageOffset` แก้ URL ตั้งแต่ render แรกที่ `count` ยังเป็น undefined
