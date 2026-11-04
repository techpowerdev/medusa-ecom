# QA — AF-18 หน้า Profile ของ portal ไม่ล้นที่ 375 (PR #277)

Spec: `docs/spec/05-affiliate.md` กฎ 42, AC-50 · commit `32b0347` · prod build (backend `medusa build`/`medusa start`, storefront `next build && next start`) · Chromium
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` (เก็บ 14 วัน)

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-50 (375×812): อีเมลยาวไม่มีช่องว่าง → `scrollWidth ≤ 375`, ขอบขวาของ `affiliate-profile-email` ≤ 375, `textContent` ตรงกับอีเมลที่สมัคร (`--repeat-each=5`) | pass (5/5) | `e2e/affiliate-profile-overflow.spec.ts` · qa-01-profile-375-long-email-code.png |
| AC-50 (1280): top ของ `<dt>` ป้ายอีเมลกับ `affiliate-profile-email` ต่างกัน ≤ 2px (repeat 5) | pass (5/5) | `e2e/affiliate-profile-overflow.spec.ts` · qa-02-profile-1280-long-email-code.png |
| AC-50: e2e เดิมของ AC-40 (Profile, `affiliate-default-link-*` คัดลอกลิงก์ — CORE-31/37) และ `affiliate-portal*` ผ่านโดยไม่แก้ locator | pass (7/7) | `affiliate-portal.spec.ts`, `affiliate-portal-pages.spec.ts`, `affiliate-portal-polish.spec.ts` |
| กฎ 42 จากมุมผู้ใช้ (QA spec) ที่ 375 / 639 / 1280: อีเมล local part 64 ตัว + domain 51 ตัว + code 32 ตัว (ค่าสูงสุดของ validator) → `scrollWidth` ≤ viewport ทุกความกว้าง, ทุก `<dd>` อยู่ในจอ, `<dd>` ไม่ล้นภายในตัวเอง, ค่าตัดบรรทัดในคอลัมน์ `<dd>` ของตัวเอง ไม่ทับแถวถัดไป, ป้ายกับค่าแถวเดียวกัน (≤ 2px), อีเมลตัดหลายบรรทัดที่ 375/639 และบรรทัดเดียวที่ 1280, ปุ่มคัดลอกลิงก์เริ่มต้นได้ status ภาษาไทย และ clipboard มี `/r/<code>` | pass (3/3) | qa-01 (375), qa-02 (1280); 639 ยืนยันจากผลวัดใน test |
| affiliate อีเมลสั้นหน้าตาเหมือนเดิม | pass | qa-03-profile-375-short-email.png + A/B: rect ของ dt/dd ทุกตัวด้วย CSS ใหม่เทียบกับ CSS เดิม ตรงกันทุก px ที่ 375/639/1280 |
| affiliate ถูกระงับเปิด Profile ได้ (200) และอีเมลยาวไม่ล้น | pass | qa-04-profile-375-suspended.png |

ข้อความไทยของ `affiliate-payout-info-status` และ `affiliate-default-link-status` ตรง regex `[฀-๿]` ทุก element หาด้วย `data-testid` ส่วน `<dt>` หาด้วย DOM relation

## Negative / edge
| กรณี | ผล |
|------|----|
| ไม่ login แล้วเปิด `/th/affiliate/profile` | redirect ไป `/th/affiliate/login` ไม่แสดงข้อมูล: pass |
| ชื่อภาษาไทยยาวไม่มีช่องว่าง (ประมาณ 130 ตัว) ที่ 375 | ไม่ล้น (Chromium ตัดคำไทยเอง): pass |
| code ยาว 32 ตัว: ลิงก์เริ่มต้นใน header และหน้า Profile | ไม่ล้น: pass |
| ชื่อ affiliate ละตินยาวไม่มีช่องว่าง (76 ตัว) ที่ 375 | **fail ดู D-1** |

## Defect
**D-1 (ความรุนแรงต่ำ, มีอยู่ก่อน PR นี้ ไม่ใช่ regression; นอกไฟล์และนอก AC ของ AF-18):** ชื่อ affiliate ยาวไม่มีช่องว่างทำให้ทุกหน้าของ portal ล้นแนวนอน รวมถึงหน้า Profile
- ขั้นตอนทำซ้ำ: สมัคร affiliate ชื่อ `QAAF18` + `N`×70 ให้ admin อนุมัติเป็น active แล้ว login portal ที่ viewport 375 แล้วเปิด `/th/affiliate/profile` (หรือ `/th/affiliate`, `/programs`, `/earnings`, `/payouts`)
- Expected (เจตนาของกฎ 42): `scrollWidth ≤ 375`
- Actual: `scrollWidth` 934–1003 ที่ 375 และ 639 (ที่ 1280 ไม่ล้น) element ที่ล้นคือ `<p>` ใน header ของ `apps/storefront/src/app/[countryCode]/(main)/affiliate/layout.tsx` บรรทัด 32–34 (`{affiliate.name} · รหัสแนะนำ ...`) ซึ่งไม่มีการตัดคำ ส่วน `<dd>` ชื่อใน `<dl>` ของ Profile ตัดบรรทัดถูกต้อง
- Evidence: qa-05-defect-375-long-name-header.png
- ส่งต่อเป็น task follow-up (เช่น `min-w-0 [overflow-wrap:anywhere]` ที่ `<p>` ของ layout พร้อม e2e ชื่อยาวที่ 375) — ไม่ block PR นี้

## Observation
- O-1: ที่ 1280 ปุ่ม "คัดลอกลิงก์" กว้างเต็มแถว (เป็นแบบนี้อยู่ก่อนแล้ว)
- O-2: ไม่พบ flake ทั้ง repeat 5 ของ e2e ใหม่และชุด regression

## สรุป
AC-50 ผ่านครบทุกเงื่อนไขบน prod build ทั้ง 375, 639 และ 1280 อีเมลสั้นได้ layout เหมือนเดิมทุก px ปุ่มคัดลอกลิงก์ยังทำงาน และ affiliate ที่ถูกระงับเปิด Profile ได้ ส่วน D-1 (ชื่อยาวล้นที่ header ของ layout) อยู่นอกไฟล์และนอก AC ของ task นี้ และมีอยู่ก่อนแล้ว
