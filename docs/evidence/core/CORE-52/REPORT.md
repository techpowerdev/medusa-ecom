# QA evidence — CORE-52 (PR #353)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 110 (a–e), AC-147 (+ AC-42 ของ spec 02, AC-111)
- commit ที่ตรวจ: รอบ 1 `7a66b1bd` (2026-11-13) → พบ D-1; รอบ 2 `7345ca1b` (2026-11-13, แก้ D-1)
- สภาพแวดล้อม: prod build ทั้งสองฝั่ง (`medusa start` จาก `.medusa/server` :9253, `next start` :8253), DB `medusa_qa353`
  สร้างใหม่ + migrate + seed, Redis db 11, Node 22, payment provider `pp_system_default` (ไม่ใช้ Stripe key จริง —
  backend ตั้ง `STRIPE_API_KEY=sk_test_dummy` แบบ job integration ของ CI)
- CI: รอบ 1 run [43370162158](https://github.com/techpowerdev/medusa-ecom/actions/runs/43370162158) (`7a66b1bd`) —
  `storefront-e2e` ล้ม 1 test ที่ไม่เกี่ยวกับ PR (`payments-promptpay-fallback-cap.spec.ts:90` AC-17, 295 passed);
  รอบ 2 run [43375451433](https://github.com/techpowerdev/medusa-ecom/actions/runs/43375451433) (`7345ca1b`) —
  Playwright HTML report + trace ฉบับเต็มอยู่ใน artifact ของ run นี้ (14 วัน)

- รอบ 3 `1db9ce75` (แก้ตาม review รอบ 3: `PaymentWrapper` คง `StripeWrapper` เมื่อ session พร้อมเพย์เป็น `authorized` หลัง `router.refresh()` —
  สาเหตุที่ AC-17 `payments-promptpay-fallback-cap.spec.ts:90` ล้มใน CI รอบ 1–2): qa ไม่ได้ตรวจซ้ำในเครื่อง (ต้องใช้หน้า authorize ของ Stripe จริง)
  ยืนยันด้วย CI run [43388010456](https://github.com/techpowerdev/medusa-ecom/actions/runs/43388010456) — `storefront-e2e` 299 passed รวม AC-17 `:47`, `:90`

## ตาราง AC (รอบ 2, `7345ca1b`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-147 ตะกร้าว่าง → reload ขั้น review → `/th/cart` + `empty-cart-message` (1280×800, 375×812) | pass | `01-empty-cart-reload-redirect.png`; `core-52-checkout-guards.spec.ts:97` ผ่านทั้งสอง viewport |
| AC-147 ลบ item แล้วกดยืนยันโดยไม่ reload → `/th/cart`, ไม่มี order ใหม่ | pass | `core-52-checkout-guards.spec.ts:119` ผ่านทั้งสอง viewport; QA-3/QA-4 |
| AC-147 เขต/อำเภอ `"   "` → error ไทย, `step=address`, cart ไม่ถูกเขียน, `shipping-country-select` = `th` | pass | `02-blank-city-error-country-kept.png`; `:141` + QA-6 |
| AC-147 digital-only: `billing-country-select` คงค่า | pass | `:224` + QA-8 |
| AC-147 (110d, D-1) ใบเสร็จแยก: error แล้ว checkbox ยังไม่ติ๊ก → แก้แล้วส่งใหม่ billing = ค่าที่กรอก | pass | `qa-05-same-as-billing-reset-after-error.png` (หลังแก้); `:177` + QA-7 + QA-10 |
| AC-147 order voucher ล้วนไม่มี `shipping-details-heading` (confirmed + account details); order มีสินค้าจัดส่งยังมี | pass | `03-voucher-order-confirmed-no-shipping.png`, `04-voucher-order-details-no-shipping.png`; `:259` |
| AC-147 grep `shipping-address/index.tsx` ไม่มี `eslint-disable` | pass | `grep -c eslint-disable` = 0 |
| AC-42 (spec 02) | pass | `ev-7d-digital-only-totals.spec.ts` 2/2 |
| AC-37/AC-3 (EV-7c, regression) | pass | `ev-7c-digital-only-checkout.spec.ts` 2/2 |
| AC-111 | pass | `core-4j-checkout-discount-address.spec.ts` 2/2 + REG-4 |

e2e ของ PR (`core-52-checkout-guards`, `ev-7c`, `ev-7d`, `core-4j`): **18 passed** (รอบ 2)

## Edge/negative + regression ของ `onReset` preventDefault (spec ของ qa — ไม่ commit ลง repo)

`e2e/core-52/qa-edge.spec.ts` (QA-1…QA-10) + `e2e/core-52/qa-regression.spec.ts` (REG-1…REG-6) รัน 3 รอบติดกันบน `7345ca1b`:
**23/23 passed ทุกรอบ** (ไม่มี flaky) — รอบ 1 บน `7a66b1bd` QA-7 และ QA-10 ล้ม (D-1)

| Test | ผล |
|------|----|
| QA-1/2 ล้างตะกร้าจากอีกแท็บ/อีก context → `/th/cart`, `nav-cart-link` = `ตะกร้า (0)` (1280, 375) | pass |
| QA-3 กดยืนยันซ้ำเร็วๆ บนตะกร้าที่ถูกล้าง → ไม่มี order, ไม่มี error ค้าง; QA-4 กดซ้ำบนตะกร้าปกติ → order เดียว | pass |
| QA-5 ตะกร้าว่างระหว่างขั้น payment → reload → `/th/cart` | pass |
| QA-6 shipping 5 ช่องบังคับ × space/tab/NBSP → error ไทย ค่าอื่น + ประเทศคงอยู่ cart ไม่ถูกเขียน | pass |
| QA-7 billing 5 ช่องบังคับ × space/tab/NBSP → checkbox ยังไม่ติ๊ก ค่า + select คงอยู่ (แก้ assertion ท้าย: ตรวจช่องบังคับ เพราะ Medusa สร้าง `shipping_address {country_code}` ตอนสร้าง cart) | pass |
| QA-8 voucher ล้วน: `billing-city-input` required + ดาวแดง; tab/space → error ไทย | pass |
| QA-10 error → แก้ → ส่งใหม่: `dom.checked=false`, ไม่ส่ง `same_as_billing`, billing.city=`บางรัก` | pass |
| REG-1 submit สำเร็จ (ใบเสร็จแยก) → กด `edit-address-button` → ทุกช่อง + checkbox (ไม่ติ๊ก) ตรงกับที่บันทึก → แก้แล้วส่งซ้ำ (1280, 375) | pass |
| REG-2 สลับ checkbox 4 ครั้ง + error ระหว่างทาง → ติ๊กกลับแล้วส่ง → billing = shipping (1280, 375) | pass |
| REG-3 ประเทศ + error → select คงค่า (region seed มีแค่ TH และ placeholder disabled — เปลี่ยนเป็นประเทศอื่นไม่ได้) | pass |
| REG-4 (AC-111) error ที่อยู่ → ใส่โค้ดส่วนลด → ค่าที่พิมพ์ + checkbox ไม่ติ๊กคงอยู่ → ส่งได้ | pass |
| REG-5 digital-only: อีเมลที่พิมพ์ (input แบบ `defaultValue`) คงอยู่หลัง error → ส่งได้ → กดแก้ไขแสดงค่าที่บันทึก | pass |
| REG-6 ที่อยู่ที่บันทึกไว้: เลือกจาก `shipping-address-select` → error → ค่าคงอยู่ → ส่งได้ | pass |
| QA-9 zero-width space (U+200B) ในเขต/อำเภอ | ข้อสังเกต O-1 |

## Defects

| รอบ | ID | ความรุนแรง | สรุป | สถานะ |
|-----|----|-----------|------|-------|
| 1 (`7a66b1bd`) | D-1 | major | ไม่ติ๊ก "ใช้ที่อยู่จัดส่งเป็นที่อยู่สำหรับออกใบเสร็จ" → กรอกใบเสร็จมีช่องว่างล้วน → error; React 19 reset `<form action>` ทำให้ checkbox กลับเป็นติ๊ก (DOM) ขณะฟอร์มใบเสร็จยังแสดง → แก้แล้วส่งใหม่ได้ `same_as_billing=on` → ที่อยู่ใบเสร็จที่กรอกหายเงียบ (expected billing.city=`บางรัก`, actual = ค่าของ shipping) | แก้แล้วใน `7345ca1b` (`onReset` preventDefault) — ยืนยันด้วย QA-7, QA-10, `:177` |
| 2 (`7345ca1b`) | — | — | ไม่พบ defect ใหม่ | — |

ข้อสังเกต (ไม่ใช่ defect ตาม spec): O-1 เขต/อำเภอเป็น U+200B ล้วนผ่าน validation (`String.trim()` ไม่ตัด ZWSP) → cart บันทึก city=`"​"` และไปขั้น delivery ได้ — เสนอเป็น follow-up
