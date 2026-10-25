# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้

## M0 Scaffold (PR นี้)
| PR | Task | สถานะ |
|----|------|--------|
| 1 | เอกสาร, agents, CI, PR template (ไม่มีโค้ดแอป) | ◐ |

## M1 ร้านค้าหลัก (ชำระเงิน manual, ข้อมูลทดสอบ)
| CORE-1 | Monorepo + แอป Medusa + starter + compose + CI | ☐ |
| CORE-2 | Seed: ประเทศไทย/THB/VAT/การจัดส่ง/สินค้า/admin | ☐ |
| CORE-3 ∥ | Resend notifications + templates | ☐ |
| CORE-4 ∥ | ธีม storefront + i18n ภาษาไทย | ☐ |
| CORE-5 ∥ | Playwright + convention การเก็บ evidence | ☐ |
| CORE-6 | การกระทำบน store เฉพาะ customer + e2e AC-1..4, AC-6 | ☐ |
| OPS-1 | Dockerfiles, worker mode, health | ☐ |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual

## M2 การชำระเงิน
| PAY-1 | ตั้งค่า Stripe + webhooks | ☐ |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☐ |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ |
| PAY-4 | Refund e2e | ☐ |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher
EV-1 → (EV-2 ∥ EV-3) → EV-4 ; EV-5 ∥ EV-6 → EV-7 — **v0.3.0**

## M4 Flash sale
PROMO-1 ∥ FS-1 → (FS-2 ∥ FS-3 ∥ FS-4 ∥ FS-5) → FS-6 — **v0.4.0**

## M5 Group buying
GB-1 → GB-2 → (GB-6 ∥ GB-3 → GB-4 → GB-5 → GB-7) — **v0.5.0**

## M6 Affiliate
AF-1 → AF-2 → AF-3 → (AF-4 ∥ AF-7) → AF-8 ; AF-5 → AF-6 — **v0.6.0**

## M7 Scale และ hardening
OPS-2 → OPS-3 → OPS-5 ; OPS-4 — **v1.0.0** 🎯

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → เจ้าของโปรเจกต์ merge → PR ถัดไป คอลัมน์สถานะอัปเดตโดย builder
