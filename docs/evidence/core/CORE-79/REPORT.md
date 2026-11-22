# QA — CORE-79 (PR #480) ปุ่ม register-login-link แตะได้ ≥ 44px และเติมอีเมลในฟอร์ม login

Spec: docs/spec/01-core-medusa.md กฎข้อ 137 / AC-178 — prod build (medusa start + next start), chromium

| AC | Result | Evidence |
|----|--------|----------|
| AC-178 (375×812) ปุ่ม `register-login-link` สูง ≥ 44 (ได้ 62.1×44px) อยู่ในจอ ไม่มี scroll แนวนอน | pass | qa480-01-register-login-link-375.png |
| AC-178 กดลิงก์ → `login-page` มี `email-input` = อีเมลเดิม และ `password-input` ว่าง ไม่มีอีเมลใน URL, localStorage หรือ sessionStorage | pass | qa480-02-login-prefilled-375.png |
| แก้อีเมลในฟอร์มสมัครหลังเห็น error แล้วกดลิงก์ → ฟอร์ม login ได้อีเมลที่แก้แล้ว | pass | qa480-03-login-edited-email-375.png |
| 1280×720 ลิงก์ 62.1×44px อยู่ในขอบฟอร์ม ไม่มี scroll แนวนอน layout ไม่เพี้ยน | pass | qa480-04-register-login-link-1280.png |
| AC-178 login ด้วยอีเมลที่เติมให้ + รหัสถูก → เข้าระบบได้ (`login-page` หายไป มี cookie `_medusa_jwt` ไม่มีอีเมลใน URL/storage) | pass | qa480-05-logged-in-375.png |
| สลับไปสมัครสมาชิกแล้วกลับด้วยปุ่ม "เป็นสมาชิกอยู่แล้ว? เข้าสู่ระบบ" → อีเมลว่าง | pass | ผล e2e (QA-4) |
| ข้อความ `register-email-exists` และตัวลิงก์ตรง regex อักษรไทย | pass | ผล e2e (QA-5) + 01 |

## Negative / edge
| กรณี | ผล |
|------|----|
| ลบอีเมลจนว่างแล้วกดลิงก์ → ฟอร์ม login ว่าง (ไม่ใช่ "undefined") | pass |
| dblclick ลิงก์ → อยู่ที่ฟอร์ม login อีเมลถูกต้อง ไม่เด้งกลับ | pass |
| คีย์บอร์ด Enter บนลิงก์ → เติมอีเมล ไม่ submit ฟอร์มสมัคร (`type="button"`) | pass |
| รหัสผิดหลังเติมอีเมล → error ไทย อีเมลยังอยู่ แล้วใส่รหัสถูก → login ได้ | pass |
| สมัครด้วยอีเมลตัวพิมพ์ใหญ่ของบัญชีเดิม → ลิงก์เติมค่าตัวเล็ก → login ได้ | pass |
| Regression core-73 ×3, core-4f, core-4h | pass |

Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #480 (14 วัน)
