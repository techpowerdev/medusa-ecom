# QA — CORE-19e (PR #166) · spec 01 กฎข้อ 71 / AC-107 (+ regression AC-64)

ตรวจที่ commit `aabe813` บน prod build (`medusa start` + `next start`) ในเครื่อง (worktree แยก, DB/Redis ของตัวเอง)
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40516546347 — ทุก job ผ่าน (storefront-e2e 108 passed)
Playwright report/trace ฉบับเต็ม: artifact `e2e-evidence` ของ run ข้างบน (เก็บ 14 วัน)

**harness ในเครื่อง (ไม่ได้ commit):** ไม่ใช้ Stripe key จริง — ใช้ payment provider ปลอมที่ id เดียวกับ Stripe
(`pp_stripe-promptpay_stripe`) และ proxy ระหว่าง Next server กับ backend ที่ตัด `payment_sessions` ออกจาก GET cart
เพื่อจำลองว่า RSC refresh ไม่นำ session มาถึง props (manual payment ไม่ทำให้ปุ่มล็อก จึงใช้แทนไม่ได้)
นับ refresh จาก request `GET` ที่มี header `rsc: 1` ไปยัง `/checkout` (ไม่นับ prefetch) และนับ server action จาก `POST` ที่มี `next-action`

| AC | Result | Evidence |
|----|--------|----------|
| AC-107 unit (Vitest + fake timers): 5s → `router.refresh` 1 ครั้งและปุ่ม disabled; 10s → ปุ่มกดได้ + error ไทย; cart ได้ session ที่ 2s → ไม่ refresh ไม่มี error | pass | `src/payment-session-lock-timeout.test.ts` (รันซ้ำในเครื่อง) |
| AC-107 flow ปกติ: เลือกพร้อมเพย์ → ปุ่มพร้อมภายใน ~0.1s, ไม่มี refresh จาก timer ภายใน 11s, ไม่มี `payment-session-pending-error`, กดครั้งเดียวไป review | pass (ในเครื่อง) | qa-ac107-normal-no-error.png |
| AC-107 refresh ไม่มาถึง: refresh 1 ครั้งที่ 5.01s (ก่อน 4.5s = 0 ครั้ง, ปุ่มยัง disabled ถึง 9.5s); ปุ่มปลดล็อกที่ ~10.3s + error "ระบบยังเตรียมการชำระเงินไม่เสร็จ กรุณาลองอีกครั้ง"; หลัง 13s ยัง refresh รวม 1 ครั้ง | pass (ในเครื่อง) | qa-ac107-timeout-error-thai.png |
| AC-107 หลังเห็น error กด Continue อีกครั้ง → error หาย, server action 1 ครั้ง, ไป step=review | pass (ในเครื่อง) | qa-ac107-retry-review.png |
| AC-107 เลือกวิธีชำระใหม่หลังเห็น error → error หาย แล้วไป review ได้ | pass (ในเครื่อง) | qa-ac107-reselect-clears.png |
| AC-64 (regression) manual 20 รอบ | pass | ในเครื่อง (prod build ต่อ backend ตรง) และ CI run ข้างบน |
| AC-64 (regression) พร้อมเพย์จริง 20 รอบ, session เดียว | pass (ตรวจจาก CI) | CI: `core-19b-continue-to-review.spec.ts` ✓; trace ไม่มี `payment-session-pending-error` ใน DOM snapshot ใด |

## Negative / edge (นอก spec)
| กรณี | ผล |
|------|----|
| กด Continue สองครั้งหลังเห็น error ขณะ session ยังไม่มาถึง | server action 1 ครั้ง ไป step=review ไม่มี error ค้าง — ส่วน "การชำระเงิน" ในขั้น review ว่างเพราะ cart ใน props ไม่มี session (พฤติกรรมเดิม นอกขอบเขต) |
| session มาถึงได้ด้วย refresh ที่ 5s | ยังสรุปไม่ได้: ในเครื่องเห็น error ที่ 10s แต่น่าจะมาจาก harness (proxy ทำให้ cart ที่ cache ไว้ค้างค่าเก่า) — ข้อสังเกต: `retrieveCart` ใช้ `force-cache` และ `router.refresh()` ไม่ revalidate tag ถ้า cache ค้างจริง refresh ที่ 5s จะไม่ช่วย เหลือแค่ fallback ที่ 10s (ส่งเป็น follow-up) |

## Defect
ไม่พบ
