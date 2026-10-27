# QA REPORT — CORE-4h (PR #162)

Spec: `docs/spec/01-core-medusa.md` (develop) กฎข้อ 69, AC-105 + regression AC-98, AC-92, AC-93
ทดสอบ: e2e บน prod build (`medusa start` + `next start`) ที่ commit e4975cd; head 8bd233e เพิ่มแค่ unit test (โค้ดแอปเหมือนเดิม) และ unit รันซ้ำที่ 8bd233e แล้ว
DB/Redis แยกของ QA, Stripe ใช้ key ปลอม (test mode)
CI (report/trace ฉบับเต็ม เป็น artifact `e2e-evidence` เก็บ 14 วัน): https://github.com/techpowerdev/medusa-ecom/actions/runs/40513657501

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-105 (a) dblclick login รหัสผ่านผิด → POST `next-action` 1 ครั้ง, `login-error-message` เป็นไทย | pass | qa-ac105-login-dblclick.png; e2e `core-4h-auth-reason.spec.ts` + QA (หน่วง action 2 วินาที, ปุ่ม disabled ระหว่างส่งแล้วกลับมากดได้) |
| AC-105 (b) สมัครด้วยอีเมลที่มีบัญชีแล้ว → ชื่อ/นามสกุล/เบอร์/อีเมลคงอยู่, error ไทย | pass | qa-ac105-register-keeps-fields.png (รหัสผ่านถูกล้าง, ข้อความ "อีเมลนี้มีบัญชีอยู่แล้ว…") |
| AC-105 (c) token ยืนยันอีเมลไม่ถูกต้อง → error ไทย ไม่ตรง `/[A-Za-z]{4,}/` | pass | qa-ac105-verify-account-error.png; ไม่มี token → ข้อความเดิม |
| AC-105 unit: login 401 → `reason: "invalid_credentials"`; component ตัดสินจาก `reason`; register 401 ที่ไม่ใช่อีเมลซ้ำ → ไม่มี "มีบัญชีอยู่แล้ว" | pass | Vitest `core-4h-auth-reason.test.ts` + `error-message.test.ts` 22/22; `use-submit-once.test.ts` + `core-4h-auth-reason.test.ts` 11/11 (8bd233e) |
| AC-98 (regression) login ผิด/สมัครอีเมลซ้ำ → error ไทย อีเมลยังอยู่ | pass | e2e `core-4f-auth-errors.spec.ts` |
| AC-92 (regression) no-JS login พร้อม add_variant → /cart ไม่ค้าง skeleton, variant ถูกลบ → add-variant-error | pass | e2e `core-14d-cart-after-login.spec.ts` (2 เคส) |
| AC-93 (regression) ล็อกอินแล้วเปิดลิงก์ add_variant → การ์ดยืนยัน (JS on/off), variant ขายไม่ได้ → error | pass | e2e `core-14d-cart-after-login.spec.ts` (3 เคส) |

e2e ของ builder + regression บน prod build: 11/11 passed (core-4h, core-4f, core-14d, thai-ui-account, register-policy-links)

## Checklist ของ PR

| ข้อ | Result |
|-----|--------|
| dblclick "เข้าสู่ระบบ" รหัสผ่านผิด → POST 1 ครั้ง, error ไทย, ปุ่มกลับมากดได้ | pass |
| dblclick "สมัครสมาชิก" (อีเมลใหม่) → action 1 ครั้ง, customer 1 รายการ | pass |
| สมัครด้วยอีเมลที่มีบัญชีแล้ว → ค่าคงอยู่, รหัสผ่านล้าง, error "มีบัญชีอยู่แล้ว" | pass |
| สมัครล้ม → แก้อีเมล → ส่งใหม่สำเร็จ (guard ปลดแล้ว) | pass (qa-edge-register-retry-success.png) |
| verify-account token ผิด/ไม่มี token | pass |
| login ผิด 1 ครั้ง → login ถูก → เข้า account ได้ | pass |

## Negative/edge (นอก spec) — QA e2e 9/9 (ในเครื่อง ไม่ได้ commit)

| กรณี | Result |
|------|--------|
| login: คลิก synchronous 5 ครั้งระหว่างหน่วง action 2 วินาที → POST 1 ครั้ง | pass |
| register: dblclick และคลิก synchronous 5 ครั้ง ระหว่างหน่วง action 2 วินาที → POST 1 ครั้ง, customer 1 รายการ | pass |
| 375px: `login-error-message`, `register-error`, `verify-account-error` ไม่ล้นจอ | pass (qa-375-register-error.png) |
| ปิด JS: login ถูกต้องยังเข้า account ได้ (onSubmit guard ไม่กระทบฟอร์ม) | pass |

## Defect

ไม่พบ

หมายเหตุ: ใน build production ในเครื่องไม่เคยเห็น action ส่งซ้ำแม้ไม่มี guard แต่ guard ตัดการกดซ้ำได้ในทุกรูปแบบที่ลอง
