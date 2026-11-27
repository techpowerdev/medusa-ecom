# QA รอบ 49 — select เป็น Radix + ที่อยู่ไทย (SFUI-15..18c)

spec: `docs/spec/09-storefront-shadcn-ui.md` หัวข้อ "ส่วน select + ที่อยู่ไทย (รอบ 49)" กฎ 39–57, AC-40–54 · ADR-033
ตรวจที่ปลาย stack `34d1be28` (ฐาน develop `283b4ed3`) แบบ prod build (backend `NODE_ENV=production` + `medusa start` จาก `.medusa/server`, storefront `next build` + `next start`), node 24, Stripe test mode + `stripe listen` (ชุด events ตาม CI) · 2026-11-28

## ผลรวม
- vitest ทั้งชุด 138 ไฟล์ / 2072 test ผ่าน (ส่วนของรอบ 49 รันแยกแบบ verbose ผ่าน 78 test)
- static (`test:e2e:unit`) ผ่าน 253 test (รวม `sfui-15-select.unit`, `sfui-13-form-guard.unit`)
- e2e 50 ไฟล์ที่อ้างหน้าคืนสินค้า/group join/checkout/ตะกร้า/PDP/บัญชี (ไฟล์ e2e ที่ stack แก้ทั้งหมด, ไฟล์ที่ grep testid/helper เจอ, `payments`, `core-19b`, `sfui-3d`) **ผ่าน 148/148** ไม่มี skip หรือ flaky (Stripe ทำงานจริง)
- qa ตรวจจากมุมผู้ใช้ desktop 1280 และมือถือ 390×844 (touch) ผ่านทั้งหมด
- ชุดเต็มรอ CI

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-40 | pass | unit `select-field-error.test.tsx` (label ก่อน trigger, combobox ชื่อ ประเทศ, `aria-required`, `renderToString`, FormData จากคีย์บอร์ด/`defaultValue` + state) |
| AC-41 | pass | unit `select-field-error.test.tsx` (ไม่ส่งฟอร์ม, `กรุณาเลือกประเทศ`, `data-invalid`/`aria-invalid`/`aria-describedby`, focus ช่องแรก) + `input.test.tsx` ผ่าน · [16b-02-country-error-add-address.png](../SFUI-16b/16b-02-country-error-add-address.png) |
| AC-42 | pass (static) | `sfui-15-select.unit.spec.ts` ผ่าน (ผล `--dry-run --diff` อยู่ใน PR ของ SFUI-15 qa ไม่ได้รันซ้ำ) |
| AC-43 | pass | e2e `sfui-16-select` (16a), `core-20/20c/20d/55/71`, `group-buy-join`, `group-buy-ui-polish`, `core-32`, `sfui-12c`, `sfui-8`, `sfui-9e` ผ่าน · [16a-01-return-reason-open.png](../SFUI-16a/16a-01-return-reason-open.png), [16a-02-group-address-390.png](../SFUI-16a/16a-02-group-address-390.png) |
| AC-44 | pass | e2e `core-store`, `core-38`, `core-52`, `core-63`, `core-23c`, `ev-7c/7d`, `thai-ui-checkout`, `affiliate-last-click`, `sfui-11`, `sfui-11b`, `sfui-12a/12b`, `core-4e/4g/4j`, `sfui-9a` ผ่าน; ประเทศคงค่าหลัง server error · [18c-02-missing-message-country-kept.png](../SFUI-18c/18c-02-missing-message-country-kept.png) |
| AC-45 | pass | e2e `sfui-16-select` AC-45 (`updateLineItem` 1 ครั้ง, qty 2), `core-44/47/48/14g/19c/42`, `pay-18`, `flash-sale-fs15`, `fs-21` ผ่าน · [16c-01-cart-qty-open.png](../SFUI-16c/16c-01-cart-qty-open.png) |
| AC-46 | pass | e2e `core-14b`/`core-24` (JS + no-JS → qty 1), `fs-23`, `sfui-16-select` 16d ผ่าน; qa: ปิด JS + login แล้วกดเพิ่ม → cart 1 ชิ้น · [16d-01-pdp-qty-open.png](../SFUI-16d/16d-01-pdp-qty-open.png), [16d-02-nojs-cart-qty1.png](../SFUI-16d/16d-02-nojs-cart-qty1.png) |
| AC-47 | pass | static `sfui-13-form-guard.unit.spec.ts` ผ่าน; grep `<select` ใน `src/modules`/`src/app` เจอเฉพาะในคอมเมนต์ |
| AC-48 | pass (ส่วนที่ qa ตรวจ) | `git diff 283b4ed3 --stat` ของ backend/`package.json`/lockfile/`globals.css`/`components/ui` ว่าง; ชุด e2e เต็มรอ CI |
| AC-49 | pass | e2e `sfui-16-select` AC-49 (ประเทศ + ตะกร้า) ผ่าน; qa แตะแล้ว popover อยู่ในจอ ไม่ล้นแนวนอน · [16b-01-country-popover-390.png](../SFUI-16b/16b-01-country-popover-390.png), [16c-02-cart-qty-390.png](../SFUI-16c/16c-02-cart-qty-390.png) |
| AC-50 | pass | unit `address-lines.test.ts`, `core-63-address-invisible.test.ts` (`address_2` ตัดช่องว่าง/zero-width) |
| AC-51 | pass | e2e `sfui-18-thai-address` AC-51 ×3 ผ่าน; qa: สรุปลำดับไทยใน checkout/order/สมุดที่อยู่/ใบเสร็จโปรไฟล์ · [18a-01-checkout-summary.png](../SFUI-18a/18a-01-checkout-summary.png), [18a-02-order-summary.png](../SFUI-18a/18a-02-order-summary.png), [18a-03-address-book-card.png](../SFUI-18a/18a-03-address-book-card.png), [18a-04-profile-billing-summary.png](../SFUI-18a/18a-04-profile-billing-summary.png) |
| AC-52 | pass | e2e `sfui-18-thai-address` AC-52 ×2, `sfui-12a/12b` (AC-37) ผ่าน; qa: 1280 คู่ ชื่อ–นามสกุล/ตำบล–เขต/จังหวัด–รหัสไปรษณีย์, 390 แถวละช่อง · [18b-01-checkout-form-1280.png](../SFUI-18b/18b-01-checkout-form-1280.png), [18b-02-checkout-form-390.png](../SFUI-18b/18b-02-checkout-form-390.png), [18b-03-add-address-modal.png](../SFUI-18b/18b-03-add-address-modal.png) |
| AC-53 | pass | unit `address-required.test.ts`, `error-message.test.ts`; e2e `sfui-18-thai-address` AC-53 ผ่าน; qa: ตำบล `required` + error `กรุณากรอกตำบล/แขวง` ครบ 5 ฟอร์ม (checkout จัดส่ง/ใบเสร็จ, เพิ่ม/แก้ที่อยู่, ใบเสร็จโปรไฟล์) · [18c-01-checkout-subdistrict-required.png](18c-01-checkout-subdistrict-required.png), [18c-02-missing-message-country-kept.png](18c-02-missing-message-country-kept.png) |
| AC-54 | pass (ส่วนที่ qa ตรวจ) | `apps/backend/**` ไม่ถูกแก้; diff ของ `sfui-baseline.json` = เพิ่ม `shipping-address-2-input`, เปลี่ยน `MISSING_ADDRESS_MESSAGE`, ลบ `อาคาร ห้อง ฯลฯ` (คง `ที่อยู่` ไว้ตามกฎ 53 "ลบเมื่อ AC-5 ไม่พบแล้ว"); diff e2e ของ 18c เป็นบรรทัดเพิ่ม ยกเว้น flag บังคับของช่องตำบลในตาราง AC-37 4 บรรทัด (reviewer รับ) |

## ตรวจจากมุมผู้ใช้ (desktop + มือถือ 390×844)
- dropdown ทุกตัวเป็น Radix: คืนสินค้า (จำนวน/เหตุผล), group join (จำนวน/ที่อยู่/วิธีจัดส่ง), ประเทศ 4 ฟอร์ม + ใบเสร็จโปรไฟล์, จำนวนในตะกร้า, จำนวนบน PDP — คลิก/แตะเปิด เลือก Escape ได้ และคีย์บอร์ด Enter/ArrowDown/Enter ใช้ได้; ข้อความบน trigger ตรงค่าใน select ซ่อน (FormData) ของฟอร์มคืนสินค้า
- error ใต้ช่องประเทศ `กรุณาเลือกประเทศ` (ไทย) + focus ที่ trigger + `aria-invalid`; เลือกค่าแล้ว error หาย
- ประเทศไม่ถูกทับหลัง form reset (server ตอบ `MISSING_ADDRESS_MESSAGE` แล้วยังเป็น `th` และช่องอื่นคงค่า)
- `billing-country-code-select` ไม่มี item `-`
- ป้ายที่อยู่ใน group join = ชื่อ + บรรทัดไทย ไม่มีจุลภาคหรือช่องว่างซ้อน
- หน้าตา select/popover และช่องที่อยู่เป็น default ของ shadcn (กฎ 45) — ไม่ถือเป็น defect

## negative / edge case
| กรณี | ผล |
|---|---|
| ตำบลว่าง (ทั้ง 5 ฟอร์ม) | browser ไม่ส่งฟอร์ม; error `กรุณากรอกตำบล/แขวง` ใต้ช่อง + focus ที่ช่อง |
| ตำบลเป็นช่องว่างล้วน (checkout) / ช่องว่าง + zero-width (แก้ที่อยู่) | `MISSING_ADDRESS_MESSAGE` ใหม่; ไม่บันทึก (address_2 เดิมยังอยู่ใน API) |
| ที่อยู่เดิมไม่มี `address_2` → เลือกใน checkout | ต้องกรอกตำบลก่อนส่ง (e2e AC-53) |
| ดับเบิลคลิก `submit-address-button` (มือถือ) | server action ส่ง 1 ครั้ง ไปขั้นจัดส่งครั้งเดียว |
| ตำบลยาว 114 ตัวอักษร (มือถือ 390) | ลง cart ครบ สรุปไม่ล้นแนวนอน |
| ปิด JS + login แล้วเพิ่มจาก PDP | cart quantity = 1 (กฎ 47) |
| Escape แล้วกด Enter ภายใน ~120ms (คีย์บอร์ด) | item ที่ focus ค้างระหว่าง animation ปิดถูกเลือก; ถ้าเว้น ≥200ms ทำงานถูกต้อง — พฤติกรรม default ของ Radix + shadcn (กฎ 45) ไม่ใช่ defect แต่ควรเป็น backlog |

## ข้อสังเกต
- สรุปที่อยู่ใบเสร็จในโปรไฟล์แสดงประเทศเป็นชื่อเต็ม (Thailand) ส่วนที่อื่นแสดง TH — คงพฤติกรรมเดิมตามคอมเมนต์ในโค้ด ไม่ขัดกฎ 57 ข้อความบรรทัดที่อยู่ (reviewer SFUI-18a รับ)
- รายการเหตุผลคืนสินค้าในภาพ 16a-01 มีหลายรายการเพราะ e2e สร้างไว้ใน DB ของ qa
- ภาพของแต่ละ task อยู่ใน `docs/evidence/storefront-select/<TASK>/` และรวมเข้ามาใน PR ของ SFUI-18c (ปลาย stack ที่ qa ตรวจ)

Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน)
