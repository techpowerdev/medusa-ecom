# รายงาน QA — CORE-4e (PR #131) ขัดเกลา checkout ภาษาไทย

- Spec: `docs/spec/01-core-medusa.md` (origin/develop) กฎข้อ 54–56, AC-90, AC-91; ADR-014
- Commit ที่ตรวจ: `ee0a2de` (branch `feat/CORE-4e-checkout-thai-polish`)
- สภาพแวดล้อม: worktree แยก, backend `medusa start` (prod build) :9184, storefront `next start` (prod build) :8184,
  DB `medusa_qa131`, Redis db 14, Node 22.23.3; Stripe ใช้ key ปลอม (flow Stripe/Elements จริงดูจาก CI)
- CI: run [40456250031](https://github.com/techpowerdev/medusa-ecom/actions/runs/40456250031) — `storefront-e2e` pass (72 passed
  รวม Stripe card/3DS/PromptPay), `lint-typecheck` pass; Playwright report/trace ฉบับเต็มเป็น artifact ของ run นี้ (14 วัน)

## ตาราง AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-90 — ไม่มี `PromptPay` ในข้อความที่ storefront เขียนเอง | ผ่าน | grep `apps/storefront/src` (ไม่รวม test/comment) เหลือเฉพาะ identifier; ชื่อวิธีชำระแสดง "พร้อมเพย์" และ `innerText` ของหน้าไม่มี `PromptPay` — `qa131-04-payment-promptpay.png` |
| AC-90 — `<Elements>` ได้ `locale: "th"` | ผ่าน (unit) | Vitest `checkout-thai-polish.test.ts` (storefront unit 292/292 ผ่าน); ข้อความใน iframe ของ Stripe ไม่ได้ตรวจด้วยภาพ (key ปลอมในเครื่อง, iframe ข้าม origin) — flow Elements ใน CI ผ่าน |
| AC-90 — `setAddresses`/`submitPromotionForm`/`renewPromptPaySession` throw `Cart not found` → ข้อความไทย; test ไม่ใช้ `indexOf` | ผ่าน (unit) | Vitest `checkout-thai-polish.test.ts` ผ่าน |
| AC-91 — placeholder `CountrySelect` ไทย ("เลือกประเทศ") | ผ่าน | e2e `core-4e-checkout-polish.spec.ts` + QA spec |
| AC-91 — popup ทักทาย/nudge มี test id, ปุ่ม X `aria-label` ไทย, กดแล้วปิด | ผ่าน | e2e `core-4e-checkout-polish.spec.ts` (`saved-address-greeting`, `free-shipping-nudge-popup`, `free-shipping-nudge-close`) |
| AC-91 — เลือกที่อยู่ที่บันทึกไว้ → label ไม่ทับค่า (วัดทันที) | ผ่าน | e2e ทั้ง 7 ช่อง (รวมนามสกุล "ใจดี") — `4e-01-saved-address-labels.png` |
| AC-91 — `{STORE_NAME} แล้ว` มีเว้นวรรค | ผ่าน | ท้ายข้อความ review = "…ความเป็นส่วนตัวของ ร้านค้าของเรา แล้ว" |

## Checklist qa ใน PR body

| รายการ | ผล | หลักฐาน |
|--------|----|---------|
| login รหัสผิด → `login-error-message` ไทย | ผ่าน | "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (รวมอีเมลที่ไม่มีในระบบ และกดซ้ำสองครั้ง); login ด้วยรหัสที่ถูกยังเข้าได้ — `qa131-02-login-error.png` |
| โค้ดส่วนลดผิด → ข้อความไทย | ผ่าน | "ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง" (กดซ้ำสองครั้ง ไม่มีส่วนลดถูกเพิ่ม) — `qa131-05-discount-error.png` |
| focus/blur label ยัง animate (login/register/profile/address) | ผ่าน | transition 0.3s ตอน focus, blur กลับที่เดิม — `qa131-03-register-375-focus.png` |
| regression: Input สูงขึ้น 4px ไม่ล้น 375px | ผ่าน | สูง 48px ใน login/register/profile/modal เพิ่มที่อยู่; ไม่มี scroll แนวนอนที่ 375px |
| ขั้นชำระเงิน "พร้อมเพย์" แบบเดียว | ผ่าน | `qa131-04-payment-promptpay.png` |
| regression e2e เดิม | ผ่าน | ในเครื่อง 15/15: thai-ui-checkout, thai-ui-account, core-22, core-23, core-14, core-14c, register-policy-links |

## Negative / edge case (นอก spec)

| กรณี | ผล |
|------|----|
| กด login/ใช้โค้ดซ้ำสองครั้งติดกัน | ข้อความไทยข้อความเดียว ไม่มี error อังกฤษ ไม่เพิ่มโค้ดซ้ำ |
| โค้ดส่วนลดที่ campaign หมดอายุ | ไม่แสดงข้อความใดและไม่ได้ส่วนลด — Medusa ตอบ 200 พร้อม `promotions: []` (พฤติกรรมเดิม) — follow-up |
| login ไม่สำเร็จ | ฟอร์มล้างอีเมลที่กรอกไว้ (พฤติกรรมเดิม) |

## Defect
ไม่พบ defect ของ PR นี้ — ทุก AC ผ่าน
