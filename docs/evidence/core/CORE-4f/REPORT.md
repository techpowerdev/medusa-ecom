# QA — CORE-4f (PR #144) error หน้า login/register เป็นไทย + คงอีเมล

- spec: `docs/spec/01-core-medusa.md` กฎข้อ 62, AC-98
- commit ที่ทดสอบ: `a1504f0`
- สภาพแวดล้อม: prod build (`medusa start` + `next start`), DB/Redis แยกของ qa, Stripe key ปลอม (test mode)
- CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40488645309 — `storefront-e2e` ✅, `lint-typecheck` ✅, `changes` ✅ (backend jobs SKIPPED ตาม `classify-changes.sh`)
  Playwright report/trace ฉบับเต็มอยู่ใน artifact ของ run นี้ (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-98 login รหัสผ่านผิด → `login-error-message` ไทย ("อีเมลหรือรหัสผ่านไม่ถูกต้อง") ไม่ตรง `/Invalid\|email\|password/i`, อีเมลคงอยู่, รหัสผ่านถูกล้าง | pass | qa-ac98-login-wrong-password.png |
| AC-98 สมัครด้วยอีเมลที่มีบัญชีแล้ว → `register-error` ไทย ("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น"), อีเมลคงอยู่ | pass | qa-ac98-register-email-taken.png |
| AC-98 unit: action login/register เมื่อ SDK throw 401/500/network → ข้อความไทยทุกกรณี + คงอีเมล | pass | Vitest `src/auth-errors-thai.test.ts` 7/7 (ในเครื่อง + CI) |
| AC-98 e2e ของ builder (`e2e/core-4f-auth-errors.spec.ts`) | pass | Playwright local + CI `storefront-e2e` |

## ตรวจเพิ่ม (negative/edge — QA spec ในเครื่อง ไม่ได้ commit, ผ่าน 7/7 ติดกัน 3 รอบ)

| กรณี | Result | Evidence |
|------|--------|----------|
| backend ล่ม (ไม่มีอะไรฟัง port) → login: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", register: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", อีเมลคงอยู่ทั้งสองฟอร์ม | pass | qa-register-backend-down.png |
| backend ตอบ 500 ทุก request → login/register ข้อความไทยเดียวกัน, อีเมลคงอยู่ | pass | ผล test QA-6 |
| login ถูกหลังเคยล้ม 2 ครั้ง (ครั้งที่สองใช้อีเมลอื่น → อีเมลล่าสุดคงอยู่) → เข้าหน้า overview ของบัญชี ไม่มี error ค้าง | pass | qa-login-ok-after-fail.png |
| 375px: error ของ login/register ไม่ล้น (scrollWidth = clientWidth, document scrollWidth = 375) | pass | qa-375-login-error.png |
| dblclick ปุ่มเข้าสู่ระบบ/สมัคร → error แสดงอันเดียว ไม่ crash (login ส่ง action 2 ครั้ง, register 1 ครั้ง) | pass | ผล test QA-3 |
| regression: สมัครด้วยอีเมลใหม่ → เข้าบัญชีได้ ไม่มี `register-error` | pass | ผล test QA-5 |
| regression: CORE-4e (AC-91), CORE-14 buy-login (AC-41/42/43/56), CORE-14b add_variant (AC-44/45 JS เปิด/ปิด), CORE-14d (AC-92/93), register-policy-links (AC-77), thai-ui-account (AC-48) | pass | Playwright 17/17 |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ block)
1. สมัครไม่สำเร็จแล้ว ชื่อ/นามสกุล/เบอร์โทรถูกล้าง เหลือแค่อีเมล (ตรงกับกฎข้อ 62 ที่บังคับเฉพาะอีเมล) — เสนอเป็นงาน UX ภายหลัง
2. dblclick ปุ่มเข้าสู่ระบบส่ง server action 2 ครั้ง ผลลัพธ์ถูกต้องและไม่สร้างข้อมูลซ้ำ
3. พิมพ์ระหว่างที่ action ก่อนหน้ายังไม่ตอบกลับ ค่าจะถูก reset เป็นอีเมลของ state ล่าสุด (พฤติกรรมของ React 19 form action เดิม)
