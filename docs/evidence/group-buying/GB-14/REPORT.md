# QA GB-14: ตรวจ shipping profile ตอน join กลุ่ม (PR #247)

spec: `docs/spec/04-group-buying.md` กฎข้อ 35, AC-54 · commit `63b2c11` (sync กับ develop `e45b046`)
สภาพแวดล้อม: prod build (backend `medusa build` + `medusa start`, storefront `next build` + `next start`), DB ที่ seed ใหม่, Stripe test mode
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #247 (job `storefront-e2e`, เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-54 (API) cart เสื้อ (Default profile) + Digital delivery ตั้งผ่าน store API → join ได้ 400 `type=not_allowed`, `code=GB_SHIPPING_PROFILE_NOT_COVERED`, `message` ขึ้นต้นด้วย `GB_SHIPPING_PROFILE_NOT_COVERED:`; membership/draft order/`progress_*` (0/0/0) ก่อน-หลังเท่ากัน และ cart ไม่มี promotion `GB-*` | pass | test QA `AC-54 a` (body จริง: `{"code":"GB_SHIPPING_PROFILE_NOT_COVERED","type":"not_allowed",...}`) |
| AC-54 cart เดิมเปลี่ยนเป็น Standard → 201 และได้ membership 1 รายการ | pass | test QA `AC-54 a` (ส่วนท้าย) |
| AC-54 cart ใหม่ + Standard → 201 | pass | test QA `AC-54 b` |
| AC-54 cart มีทั้ง Standard และ Digital → 201 | pass | test QA `AC-54 c2` (เพิ่ม Digital ด้วย SQL ดูข้อสังเกต 1) |
| AC-54 ไม่มี shipping method → 201 (กฎข้อ 35c, Q22 = ก) | pass | test QA `AC-54 d` |
| AC-54 ทุก line `requires_shipping=false` + Digital → 201 | pass | test QA `AC-54 e` |
| AC-54 กลุ่มเต็ม + Digital → 409 `GB_GROUP_FULL` (409 มาก่อน) | pass | test QA `AC-54 f` |
| กฎข้อ 35d (UI 1280px) เลือก Digital delivery ให้เสื้อในหน้ากลุ่มแล้วกดเข้าร่วม → `group-join-error` = "วิธีจัดส่งที่เลือกใช้กับสินค้านี้ไม่ได้ กรุณาเลือกวิธีจัดส่งใหม่" ไม่ใช่ข้อความของ `closed` ไม่มีอักษรละติน ยังอยู่หน้ากลุ่ม ไม่มี membership และ cookie cart ไม่เปลี่ยน | pass | qa-01-ui-error-desktop.png |
| กฎข้อ 35d (UI 375px) เหมือนข้างบน และไม่มีการเลื่อนแนวนอน (overflow 0px) | pass | qa-02-ui-error-375.png |
| แก้ตาม error: เลือก Standard แล้วกดเข้าร่วมอีกครั้ง → ไปหน้า `/th/account/orders` ได้ membership 1 รายการ และ draft order มีเฉพาะ Standard | pass | qa-03-ui-retry-standard.png |
| unit Vitest `group-join-error.test.ts` | pass | 12/12 tests |
| grep: `CHECKOUT_CONFLICTS` ใน `checkout-error.ts` ไม่มี `GB_` | pass | ผล grep ว่าง |
| AC-28 regression `e2e/group-buy-join.spec.ts` | pass | 7/7 tests (รวม 409 `GB_GROUP_FULL`/`GB_UNITS_LIMIT_EXCEEDED` และกลุ่มหมดเวลา) |
| `core-32-shipping-profile-filter.spec.ts` | ข้าม | ยังไม่มีบน develop ตอนทดสอบ (CORE-32 #243 ยังไม่ merge) |

## Negative / edge case
| กรณี | ผล |
|------|-----|
| ยิง join พร้อมกัน 2 ครั้งด้วย cart ที่ตั้ง Digital | 400 ทั้งคู่ (code เดียวกัน) ไม่มี membership/draft order/promotion ใหม่: pass |
| กลุ่มหมดเวลา + Digital | 400 "The group is no longer open for joining" (error กลุ่มปิดมาก่อน ไม่ใช่ code ใหม่): pass |
| ไม่ login + cart ที่ตั้ง Digital | 401 ไม่ถึงขั้นตรวจ: pass |
| สินค้าไม่มี shipping profile (ปลด link ชั่วคราวด้วย SQL) + Standard | 400 `GB_SHIPPING_PROFILE_NOT_COVERED` (line ที่ไม่มี profile ถือว่าไม่ครอบ): pass |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
1. store API ของ Medusa ไม่มี route ลบ shipping method และเมื่อเพิ่ม Standard ลงใน cart ที่มี Digital อยู่ Medusa จะแทนที่ method เดิม จึงสร้าง cart ที่มีทั้งสอง method ผ่าน store API ไม่ได้ QA ใช้ SQL เพิ่ม Digital ทั้งนี้ integration test ของ PR ใช้ cart module ทำกรณีนี้อยู่แล้ว
2. ที่ทำซ้ำใน UI ได้เพราะ dropdown วิธีจัดส่งของหน้ากลุ่มยังแสดง "Digital delivery — ฿0" ให้สินค้าที่ต้องจัดส่ง (ก่อน CORE-32 #243 merge) หลัง CORE-32 ลูกค้าทั่วไปจะไม่เจอ error นี้จาก UI และ guard ของ GB-14 จะเหลือหน้าที่กันการยิงผ่าน API
3. หน้า `/account/orders` ใน qa-03 แสดง "ยังไม่มีคำสั่งซื้อ" คู่กับคำสั่งซื้อแบบกลุ่ม ซึ่งอยู่ในขอบเขตของ GB-12 (AC-51, #244) ไม่เกี่ยวกับ PR นี้

## สรุป
AC-54 และกฎข้อ 35 (a)–(d) ผ่านครบทั้งฝั่ง API และ UI บน prod build ที่ 1280px และ 375px, regression AC-28 ผ่าน, ไม่พบ defect จึงพร้อม merge ในส่วนของ QA
