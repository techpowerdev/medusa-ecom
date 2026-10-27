# QA: AF-8b — portal แถบนำทาง + Programs / Earnings / Payouts / Profile (PR #173)

Spec: `docs/spec/05-affiliate.md` (กฎ 8, 33, 34; AC-40; Q6) — ตรวจที่ HEAD `a5916ad` บน prod build (`medusa start` + `next start`), Stripe key ปลอม
Test: `apps/storefront/e2e/affiliate-portal-pages.spec.ts` (builder, 2/2), `apps/storefront/e2e/affiliate-portal.spec.ts` (AF-8a regression, 4/4),
QA spec (ในเครื่อง ไม่ได้ commit, 4/4), Vitest `affiliate-portal.test.ts` 30/30
Playwright report + trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน) — https://github.com/techpowerdev/medusa-ecom/actions/runs/40536649781

| AC | Result | Evidence |
|----|--------|----------|
| AC-40 nav 5 เมนูเป็นไทย + `aria-current` ตรงหน้าปัจจุบันทุกหน้า | pass | qa-01-programs.png |
| AC-40 Programs: active/upcoming แถวละ 1 แถว ป้ายไทย อัตรา วันที่ (เขตเวลาไทย) `announce_text`; draft/หมดอายุไม่แสดง | pass | qa-01-programs.png |
| AC-40 Earnings: pending ฿30 / approved ฿50 / paid ฿100 / reversed -฿20 ตรงกับแถวของ `GET /affiliate/me/earnings` ทีละสถานะ + คำอธิบายไทย; ไม่มีแถว → ฿0 | pass | qa-02-earnings.png |
| AC-40 Payouts: 1 แถว ฿100 "จ่ายแล้ว" ไม่มี reference ทั้งใน DOM, HTML และ response | pass | qa-04-mobile-payouts.png |
| AC-40 Profile: `affiliate-default-link` = `{storefront}/r/<code>`, คัดลอกได้, `affiliate-payout-info-status` ไทย ทั้ง `has_payout_info` true / false | pass | qa-03-profile.png |
| AC-40 / Q6 suspended: Products/Programs แสดง `affiliate-status-notice` ไทย (status < 500); Earnings ยอดตรงกับ API; Payouts ว่างแสดงข้อความไทย | pass | e2e builder + QA |
| Q6 pending: Products/Programs/Earnings/Payouts แสดง notice ไทย (status < 500); Profile เปิดได้ | pass | qa-05-pending-notice.png |
| กฎ 8/34: ค่าใน `payout_info` และคำว่า `payout_info` ไม่อยู่ใน HTML, RSC payload และ DOM ของ Profile | pass | e2e QA |
| กฎ 17: cookie `_affiliate_jwt` httpOnly + SameSite=Lax, `document.cookie` ไม่เห็น, token ไม่อยู่ใน response ใดของ storefront | pass | e2e QA |
| mobile 375px: ทั้ง 5 หน้าไม่มี horizontal overflow, nav ขึ้นบรรทัดใหม่ได้ | pass | qa-04-mobile-payouts.png |
| AF-8a regression (AC-9, AC-35, pending/suspended/customer) | pass | e2e builder |

## Negative / edge case
| กรณี | ผล |
|------|----|
| ไม่ login แล้วเปิดทั้ง 5 หน้า | redirect ไป `/th/affiliate/login` ไม่มี 5xx |
| customer login อยู่ แล้วเปิด portal | redirect ไป login ไม่เห็นข้อมูล |
| token ของ customer หรือ token มั่วใน `_affiliate_jwt` | 401 → redirect ไป login ไม่มี 500 |
| `?page=abc`, `-1`, `999`, `1000000000`, `page` ซ้ำ บน Programs/Payouts | 200 ทุกกรณี |
| ยอด approved 33.33 + 0.1 + 0.2 | ฿33.63 ตรงกับ API ไม่เพี้ยนจาก float |
| ดับเบิลคลิกปุ่มคัดลอก | ไม่ error clipboard ถูกต้อง |
| logout แล้วกด back/reload | อยู่ที่หน้า login |

## ข้อสังเกต (ไม่ block)
- `?page=` ที่เกินจำนวนหน้าแสดงข้อความ "ยังไม่มี…" ทั้งที่มีรายการในหน้าแรก (มีลิงก์ "หน้าก่อน")
- ยอด reversed แสดง "-฿20" ใช้ขีดสั้น ไม่ใช่ "−" ตามที่ spec เขียน (ยังตรง regex ของ AC)
- รัน e2e ของ builder แบบเปิด `E2E_SAVE_EVIDENCE=1` หลังมีรูป QA ครบ 5 จะล้มเพราะเกินงบ (ตามกฎข้อ 67) — ไม่ใช่ defect

Defect: ไม่พบ
