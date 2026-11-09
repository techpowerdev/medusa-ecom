# QA — CORE-19f (PR #310) · spec 01 กฎข้อ 75 / AC-113 (+ regression AC-64, AC-107)

| รอบ | commit ที่ตรวจ | CI run | ผล |
|-----|----------------|--------|----|
| 1 | `5f380e7f` | https://github.com/techpowerdev/medusa-ecom/actions/runs/42526168546 | storefront-e2e FAIL (250 passed, 1 failed = `core-19f-switch-payment-method`) → D-1 |
| 2 | `b8814488` (แก้ D-1) | https://github.com/techpowerdev/medusa-ecom/actions/runs/42530790533 ([job storefront-e2e](https://github.com/techpowerdev/medusa-ecom/actions/runs/42530790533/job/128884647211)) | ทุก job `success`/`skipped` — storefront-e2e 251 passed |

Playwright report/trace ฉบับเต็ม: artifact `e2e-evidence` ของแต่ละ run (เก็บ 14 วัน; รอบ 2 หมดอายุ 2026-11-22)

**harness ในเครื่อง (ไม่ได้ commit):** prod build (`medusa start` + `next start`), worktree แยก, DB `medusa_qa310b`, Redis db 12, backend :9208, storefront :8208, admin ปิด (`DISABLE_MEDUSA_ADMIN`) ไม่มี Stripe key จึงใช้ manual provider (`pp_system_default`) และ proxy (:9218) ระหว่าง Next server กับ backend: โหมด `strip` ตัด `payment_sessions` ออกจาก GET cart เพื่อจำลองว่า refresh ไม่นำ session มาถึง props และโหมด `slow:<ms>` หน่วง POST payment-collections/sessions; นับ server action จาก `POST` ที่มี `next-action` และนับ refresh จาก `GET` ที่มี `rsc: 1`

## ผลต่อ AC (รอบ 2 ที่ `b8814488`)
| AC | Result | พิสูจน์ที่ | Evidence |
|----|--------|-----------|----------|
| AC-113 (a) unit: action สร้าง session เรียก `revalidateTag` ของ cart ก่อนคืนผล | pass | ในเครื่อง | `src/core-19f-revalidate-session.test.ts` (Vitest 4 ไฟล์ 13 test ผ่าน รวม AC-107) |
| AC-113 (b) component (jsdom + fake timers) รวม test ใหม่: เปลี่ยนวิธีชำระ / กลับไปขั้นอื่นระหว่างรอ → ไม่ push review | pass | ในเครื่อง | `src/core-19f-continue-after-timeout.test.ts` |
| AC-113 (b) e2e manual ×3 รอบ: refresh ไม่มาถึง → refresh 1 ครั้งที่ ~5.1s, ปลดล็อก + error ไทยที่ 10.1–10.2s, URL ยัง `step=payment` | pass | ในเครื่อง | qa-ac113-timeout-unlock-thai-error.png |
| AC-113 (b) e2e manual ×3 รอบ: กด Continue หลังปลดล็อก → server action 1 ครั้ง, ปุ่มล็อก, ไม่ไป review; timeout รอบสองที่ 10.2–10.4s ยังไม่ไป review; session มาถึง → Continue → review มีข้อความไทย, session เดียว | pass | ในเครื่อง | qa-ac113-continue-after-timeout-locked.png |
| AC-113 (c) e2e Stripe: บัตร → พร้อมเพย์ → บัตร → Continue 1 ครั้ง → review แสดงบัตร, cart มี session บัตรเท่านั้น | **pass** (รอบ 1 fail = D-1) | **CI เท่านั้น** (ในเครื่องไม่มี Stripe key) | run 42530790533: `core-19f-switch-payment-method.spec.ts:20` ✓ (8.6s) |
| AC-113 unit ของ fix D-1: `<Elements>` ผูก client secret ล่าสุดเมื่อบัตร, คงตัวเดิมเมื่อพร้อมเพย์ | pass | ในเครื่อง | `src/core-19f-stripe-wrapper-key.test.ts` |
| AC-64 manual: Continue 1 ครั้ง → review ภายใน 10s (QA 5 รอบ × 3 ชุด = 122–869ms; `core-19b` 20 รอบ × 3 ชุด) | pass | ในเครื่อง + CI | qa-ac113-manual-review.png; CI `core-19b-continue-to-review.spec.ts:22` ✓ |
| AC-64 PromptPay 20 รอบ session เดียว | pass | CI เท่านั้น | CI `core-19b-continue-to-review.spec.ts:73` ✓ (ในเครื่อง skip เพราะไม่มี Stripe) |
| Stripe regression | pass | CI | `payments.spec.ts` AC-1/2/3/4/5/9 ✓, `payments-promptpay-already-paid.spec.ts` ✓ ×2 |
| AC-107 (regression) unit | pass | ในเครื่อง | `src/payment-session-lock-timeout.test.ts` |
| ภาษา/layout 1280×800, 375×812 ขั้น payment + review | pass | ในเครื่อง (×3) + CI | ผล test ภาษาของ QA และ `thai-ui-checkout` ✓ ×3; ไม่มี horizontal overflow; คำอังกฤษที่เหลือเป็นข้อมูลทดสอบ/seed |

## Negative / edge (นอก spec)
| กรณี | ผล |
|------|----|
| กดเปลี่ยนวิธีชำระ (บัตร แล้วกลับ manual) ระหว่างรอ session หลัง Continue แล้วปล่อย session | ไม่ไป review เอง เฝ้าดู 13s, ยัง `step=payment`; กด Continue เองแล้วไป review ได้ — pass (qa-310b-switch-during-wait.png) |
| กด "แก้ไข" ขั้นจัดส่ง / ที่อยู่ ระหว่างรอ session แล้วปล่อย session | อยู่ที่ `step=delivery` / `step=address` ต่อ ไม่ถูก push ไป review (refresh 5s ยังยิง 1 ครั้งแต่ไม่ย้ายขั้น) — pass (qa-310b-edit-delivery-during-wait.png) |
| dblclick / กดสองครั้งห่าง 150ms, 600ms / กดครั้งเดียว | 24/24 (×3 รอบ) + 30/30 ใต้ CPU load ~14 (4 worker + burner 6 process): server action 1 ครั้ง, ไป review, session เดียว |
| ข้อสังเกตรอบ 1 (a): spinner ค้าง > 30s ตอนเครื่องโหลดสูง | **ทำซ้ำไม่ได้** ในรอบ 2 (54 รอบรวมใต้ load) — ปิดข้อสังเกต; รอบ 1 เกิดตอนเครื่อง swap เต็ม |
| ข้อสังเกตรอบ 1 (b): backend สร้าง session ช้า | หน่วง 4s/request (รวม ~8s) → review ที่ 8.6–8.7s (×4); หน่วง 5.5s (รวม ~11s) → review ที่ ~11.8s ปุ่มแสดง "กำลังดำเนินการ..." ตลอด ไม่ค้าง — ไม่ใช่ defect (ดูคำตัดสินด้านล่าง) |
| reload ระหว่างรอ session (strip) ×3 | หน้าไม่พัง ไม่มี `pageerror`; session มาแล้ว reload → Continue → review |
| สองแท็บ cart เดียวกัน ×3 | แท็บ B ไป review, cart มี session เดียว |
| "Continue ระหว่างล็อกแล้ว session มาถึงด้วย refresh 5s" | ล้ม 3/3 ในรอบ 2 แต่**เป็นข้อจำกัดของ harness ไม่ใช่ defect**: log proxy แสดงว่า RSC ที่ render หลัง action ดึง GET cart ตอนโหมด `strip` แล้ว Next เก็บไว้ใน `force-cache` และ `router.refresh()` ที่ ~5.1s ไม่มี GET cart ผ่าน proxy เลย จึงได้ cart ที่ถูกตัดจาก cache (ในระบบจริง cache จะเก็บ cart ที่มี session) ทางไป review เองหลัง session มาถึงพิสูจน์แล้วจาก AC-64 manual (manual สร้าง session ตอน Continue ทุกรอบ) และ slow probe |

**คำตัดสินข้อ (b) เวลา 10 วินาที:** AC-64 (spec 01 บรรทัด 576–577) นับ "ภายใน 10 วินาที" จากการกด Continue ครั้งเดียว ภายใต้ Given "checkout ที่กรอกที่อยู่/shipping/payment ครบ" ซึ่งไม่ได้กำหนดเวลาตอบของ backend → ในสภาพปกติผ่าน (≤ 0.9s ในเครื่อง, CI ✓) ส่วนกฎข้อ 71 (บรรทัด 1005–1007) นับ 10s "จากเริ่มล็อก" ซึ่งหมายถึงล็อกของ CORE-19b ที่ "ล็อกไว้จน cart (props) มี session" คือเริ่มหลัง action สร้าง session คืนผล — โค้ดเริ่ม timer ตรงตามนั้น และกฎข้อ 75 (บรรทัด 1076–1078) ไม่ได้กำหนดเวลาเพิ่ม ⇒ กรณี backend ช้าเกิน ~9s เป็นข้อสังเกต (latency ของ backend) ไม่ใช่ defect ถ้าต้องการงบเวลาเมื่อ backend ช้า ให้ planner เพิ่มถ้อยคำใน spec

**ข้อจำกัด:** ผลข้างเคียงของ fix D-1 (session บัตรเปลี่ยน → Payment Element mount ใหม่ ต้องกด Continue เอง) ทดสอบในเครื่องไม่ได้เพราะไม่มี Stripe key — ครอบคลุมโดย unit `core-19f-stripe-wrapper-key` และ CI e2e AC-113 (c)

## Defect
| ID | รอบที่พบ | AC | สถานะรอบ 2 | รายละเอียด |
|----|----------|----|-------------|------------|
| D-1 | 1 (`5f380e7f`) | AC-113 (c), blocker | **แก้แล้ว** — CI run 42530790533 ✓ | สลับ บัตร → พร้อมเพย์ → บัตร แล้วไม่พบ iframe ช่องเลขบัตรของ Stripe ภายใน 30s (`support/stripe.ts:146`) เพราะ `<Elements>` ไม่รับ `clientSecret` ใหม่หลัง mount; fix: `key` ของ `<Elements>` = client secret เมื่อบัตร |
| — | 2 (`b8814488`) | — | ไม่พบ defect ใหม่ | — |
