# QA REPORT: AF-8c (PR #182)

Spec: `docs/spec/05-affiliate.md` กฎ 35, 36, AC-41 (+ regression AC-40, Q6)
สภาพแวดล้อม: prod build (`medusa start` + `next start`), DB ที่เพิ่ง seed, Stripe key ปลอม (test mode)
CI (report/trace ฉบับเต็ม เป็น artifact 14 วัน): https://github.com/techpowerdev/medusa-ecom/actions/runs/40574633645

| AC | Result | Evidence |
|----|--------|----------|
| AC-41 นับถอยหลัง: ~3 ชม. → "เริ่มในอีก 3 ชั่วโมง" (ไม่มี "วัน"), 49 ชม. → "เริ่มในอีก 2 วัน", 30 นาที → "เริ่มในอีกไม่ถึง 1 ชั่วโมง"; browser timezone Pacific/Kiritimati และ America/Los_Angeles ได้ผลเดียวกัน | pass | qa-ac41-countdown.png |
| AC-41 การ์ด `rate_varies=true` ไม่มี `affiliate-estimate` มี `affiliate-rate-varies` "สูงสุด 15%"; `rate_varies=false` ราคา 100/200 อัตรา 10% → "ได้ประมาณตั้งแต่ ฿10"; ราคาเดียว ฿300 → "ได้ประมาณ ฿30" ไม่มี "ตั้งแต่" | pass | qa-ac41-cards.png |
| AC-41 ปิด backend แล้วเปิด Products/Programs/Earnings/Payouts → `affiliate-portal-error` อักษรไทย + `affiliate-portal-retry`, HTTP < 500, ไม่มี `__next_error__`; เปิด backend แล้วกดลองใหม่ → Payouts โหลดปกติ | pass | qa-ac41-portal-error.png |
| AC-41 unit (Vitest) `af-8c-portal.test.ts` + `affiliate-portal.test.ts` | pass (60/60) | ผล Vitest |
| AC-40 regression: Bob `suspended` → `affiliate-status-notice` ที่ Products/Programs (ไม่ใช่ portal error), Earnings/Payouts ตอบ 200 | pass | ผล test ของ QA |
| กฎ 36b: token ปลอม (401) และ logout/ลบ cookie → redirect ไป login ทั้ง 4 หน้า | pass | ผล test ของ QA |
| Regression AF-8b: `affiliate-portal-pages.spec.ts` (AC-40 ×2) | pass | ผล test |
| Regression AF-8a: `affiliate-portal.spec.ts` (AC-9/AC-35) | รอบแรก **fail** (D1) → หลังแก้ pass | CI `storefront-e2e` run [40587923655](https://github.com/techpowerdev/medusa-ecom/actions/runs/40587923655) |
| มือถือ 375px: active/upcoming/programs/earnings ไม่ล้นแนวนอน | pass | qa-375-upcoming.png |

## Defect
- **D1** `apps/storefront/e2e/affiliate-portal.spec.ts:104` ยังคาดหวังให้ `affiliate-estimate` ของการ์ด `rate_varies=true` มีคำว่า "สูงสุด" ซึ่งขัดกับกฎ 35b จึงล้ม ("element(s) not found") ต้องแก้ test เป็น `toHaveCount(0)` — **แก้แล้ว** (builder แก้ step ตามกฎ 35b; CI run 40587923655 storefront-e2e ผ่านทั้งชุด)

## Negative / edge case
- ทดสอบ timezone ของ browser ไว้ 2 โซน (UTC+14 / UTC−8): countdown render จาก server ไม่เปลี่ยน
- token ปลอมใน cookie `_affiliate_jwt` → ไป login ไม่แสดง portal error
- การ์ดที่ขึ้น "เริ่มในอีก 24 ชั่วโมง" ตอนเหลือ 23.x ชม. ถูกตามกฎ 36a (ปัดขึ้น)
- 5xx ที่ไม่ใช่ network ล้ม ยังพิสูจน์ได้จาก unit (mock `sdk`) เท่านั้น
