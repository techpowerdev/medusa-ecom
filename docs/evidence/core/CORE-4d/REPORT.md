# QA REPORT — CORE-4d (PR #109) ข้อความไทยใน checkout ทุกขั้น

- Spec: `docs/spec/01-core-medusa.md` (CORE-4: AC-48 4d, AC-49 4d, AC-75) / ADR-014
- Commit ที่ตรวจ: `7f18d82` (branch `feat/CORE-4d-checkout-thai`)
- สภาพแวดล้อม: worktree แยก, backend :9131, storefront :8131 (`next build && next start`), DB `medusa_qa109` (migrate + seed), Node 22; ในเครื่องไม่มี Stripe key → ส่วน Stripe ดูผลจาก CI
- CI: run [40396871213](https://github.com/techpowerdev/medusa-ecom/actions/runs/40396871213) — `storefront-e2e` ผ่าน 48 test (รวม payments/PromptPay ที่ใช้ Stripe test key); report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` (เก็บ 14 วัน)

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-48 (4d) checkout ทุกขั้น + not-found ของ `(checkout)` | pass | `4d-01-address-th.png`, `4d-02-delivery-th.png`, `4d-03-payment-th.png`, `4d-04-review-th.png`; e2e `thai-ui-checkout.spec.ts` + e2e ของ qa ผ่าน 7/7 |
| AC-49 (4d) ESLint path 4d, lint 0 error | pass | config มี `(checkout)/**`, `modules/{checkout,shipping}/**`, `lib/constants.tsx`; lint 0 error; mutation `<p>Hello World</p>` ใน 3 ไฟล์ → `no-restricted-syntax`; unit ผ่าน 224/224 |
| AC-75 `review-terms` ไทย + ชื่อร้าน | pass | `4d-04-review-th.png`, `4d-05-promptpay-qr-th.png` (CI); e2e: มีอักษรไทย, มี `STORE_NAME`, ไม่ตรง `/Medusa/i`; grep ไม่พบ `Medusa Store` |

## Checklist ใน PR
| รายการ | Result | หลักฐาน |
|--------|--------|---------|
| สแกนทั้งหน้าทุกขั้น ไม่มีคำอังกฤษที่ storefront เขียนเอง | pass | qa e2e: คำละตินที่เหลือ = `[]` (กรองข้อมูล backend และ "PromptPay" ตาม ADR-014 ข้อ 4 แล้ว) |
| not-found ไม่มี cart | pass | test id ไทยทั้ง 3 ตัว, title ไทย, สแกนทั้งหน้าผ่าน |
| PromptPay / บัตร (CI) | pass | CI payments AC-1..5 + promptpay-* ผ่าน; `4d-05-promptpay-qr-th.png`; unit `user-messages-thai.test.ts` |
| ที่อยู่ที่บันทึกไว้ | pass | ข้อความทักทาย + `shipping-address-select` เป็นไทย, เลือกแล้วกรอกฟอร์มถูกต้อง |
| โค้ดส่วนลดผิด | pass | `discount-error-message` = "ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง" |
| shipping nudge | pass | "ซื้อเพิ่มเพื่อรับสิทธิ์ส่งฟรี / อีก ฿99,410 จะได้ส่งฟรี / ดูตะกร้าสินค้า / ดูสินค้า" |

## Negative / edge case
| กรณี | ผล |
|------|----|
| ดับเบิลคลิก `submit-order-button` | ได้ order เดียว |
| ดับเบิลคลิกใช้โค้ดส่วนลดผิด | error แสดงครั้งเดียว ไม่มี `discount-row` |
| เปิด `?step=review` ก่อนกรอกที่อยู่ | 200 ไม่ crash ไม่แสดงปุ่มยืนยัน และทั้งหน้าเป็นไทย |

## ข้อสังเกต (นอก scope 4d — ไม่ block)
1. ข้อความทักทายที่อยู่ที่บันทึกไว้และ popup ของ nudge ไม่มี `data-testid` (กฎข้อ 7)
2. ปุ่ม X ของ nudge popup ไม่มี `aria-label`
3. หลังเลือกที่อยู่ที่บันทึกไว้: floating label ซ้อนกับค่าที่กรอก และ select ยังแสดง "เลือกที่อยู่" (ไฟล์ที่เกี่ยวข้องไม่อยู่ใน diff นี้)
