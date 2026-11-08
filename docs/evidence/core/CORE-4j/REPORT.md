# รายงาน QA — CORE-4j (PR #314)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 73 (a–d), AC-111; regression CORE-4g (AC-99)
- Branch: `feat/CORE-4j-discount-trim-address-form` @ `756b0b11`
- สภาพแวดล้อม: prod build ทั้งสองฝั่ง (backend `medusa build` + `medusa start`, storefront `next build` + `next start`), DB seed ใหม่, manual payment provider (ไม่มี Stripe key จริง)
- หา element ด้วย `data-testid` ทั้งหมด; ตรวจภาษาด้วย regex อักษรไทย (`THAI` ใน `e2e/support/thai-text.ts`)
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #314 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-111 (73a) โค้ด `"  <code>  "` → `cart.promotions` มี code นั้น ไม่แปลงตัวพิมพ์ — `/checkout` และ `/cart` | pass | qa314-01-1280-trim-code-form-kept.png; e2e |
| AC-111 (73a) โค้ดตัวพิมพ์ผิด → `promotion-error` ไทย, cart ไม่มีโค้ด — `/checkout` (1280/375) และ `/cart` | pass | qa314-02-375-wrong-case-error-form-kept.png |
| AC-111 (73a) ช่องว่างล้วน → ไม่ส่ง server action (POST `next-action` = 0) ไม่มี error — `/checkout` และ `/cart` | pass | ผล e2e |
| AC-111 (73b) 1280: พิมพ์ทับที่อยู่จัดส่ง + ใบเสร็จ + อีเมล (ไม่บันทึก) → ใส่โค้ด → ค่าไม่หาย; บันทึกแล้วสรุป/cart เป็นค่าที่พิมพ์ | pass | qa314-01-1280-trim-code-form-kept.png |
| AC-111 (73b) 375: เหมือนข้างบน | pass | qa314-02-375-wrong-case-error-form-kept.png + ผล e2e |
| AC-111 (73b) cart ใหม่: อีเมลเติมจาก customer → แก้อีเมลแล้วใส่โค้ด → ไม่ถูกทับ | pass | ผล e2e |
| AC-111 (73c) `/account/profile` `billing-country-code-select` สูง 48px = `billing-province-input` (1280, 390); กรอบ/ขอบมน/hover ตรงกับ input | pass | qa314-04-390-profile-billing-select.png |
| AC-111 (73d) `createExpiredPromotion` ตรวจ `ok()` ของการลบ campaign | pass | `core-4j-e2e-hygiene.unit.spec.ts` 1 passed |
| Regression CORE-4g (AC-99): เลือกที่อยู่ที่บันทึกไว้แล้วใส่โค้ด → ฟอร์ม/dropdown ยังเป็นที่อยู่ที่เลือก, บันทึกได้ | pass | qa314-03-saved-address-select-after-code.png; `core-4g` 1 passed |

ค่าที่วัด (`/account/profile`, 1280 และ 390 เท่ากัน): select 48px, province 48px, city 48px; กรอบ rgb(228,228,231) 1px ขอบมน 6px ทั้ง select และ input; พื้นปกติ rgb(250,250,250); hover rgb(244,244,245) ทั้งคู่; select ที่ 390 กว้าง 342px ไม่ล้นจอ

## Negative / edge case

| กรณี | ผล |
|------|----|
| ใส่โค้ดผิดตัวพิมพ์ → ค่าฟอร์มที่พิมพ์ค้าง (ที่อยู่จัดส่ง 8 ช่อง + ใบเสร็จ 5 ช่อง) ยังอยู่ | pass |
| ลบโค้ด → ค่าฟอร์มยังอยู่ | pass |
| กดใส่โค้ดสองครั้งเร็วๆ ขณะพิมพ์ค้าง → cart มีโค้ดเดียว ไม่มี error ค่าไม่หาย | pass |
| บันทึกที่อยู่ → แท็บ B แก้ที่อยู่ใน `/account/addresses` → แท็บ A กดแก้ที่อยู่: dropdown มีที่อยู่ใหม่ เลือก + ใส่โค้ด ค่าคงอยู่ บันทึกได้ | pass |
| แท็บ B บันทึกที่อยู่ cart ใหม่ใน checkout → แท็บ A (ฟอร์มเปิด) refresh cart → ฟอร์ม sync เป็นที่อยู่ใหม่; reload ได้ที่อยู่ใหม่ | pass |
| ไป-กลับขั้น: บันทึกที่อยู่ → delivery ใส่โค้ด → แก้ที่อยู่ → ฟอร์มเป็นค่าที่บันทึก; back/forward ของ browser → ค่าที่บันทึก | pass |
| สังเกต: พิมพ์ค้างในแท็บ A แล้วแท็บ B บันทึกที่อยู่ cart ใหม่ → แท็บ A refresh แล้วค่าที่พิมพ์ถูกแทนด้วยที่อยู่ที่บันทึกล่าสุด (ตรงเจตนากฎ 73b) | สังเกต |

## Regression ที่รันเพิ่ม (prod build, `--workers=1`)
`core-4g` 1, `core-4j` 2, `core-40` 1, `core-4e` 1, `core-38` 5, `core-23c` 5 — ผ่านทั้งหมด; e2e ของ QA 10 tests ผ่านทั้งหมด

## Defect
ไม่พบ
