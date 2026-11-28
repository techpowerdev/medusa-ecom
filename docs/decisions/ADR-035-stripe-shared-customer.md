# ADR-035 Stripe customer เดียวต่อลูกค้า (บัตร + พร้อมเพย์) — subclass provider ของ `@medusajs/payment-stripe` แก้ bug idempotency ของ Medusa 2.22.1

สถานะ: **accepted** (owner 2026-11-29 — เลือก "ลูกค้า 1 คนใช้ Stripe customer ตัวเดียวทุกวิธีจ่าย" ก่อนเขียน ADR นี้; planner บันทึก 2026-11-29)
เกี่ยวข้อง: spec 01 หัวข้อ "Follow-up รอบ 51" (กฎข้อ 157, AC-198–AC-199, task PAY-26) · **ขยาย** ADR-007 (ยังใช้ Stripe provider ของ Medusa, `capture: true`; ไม่ใช่ "provider ที่สร้างเอง" — ทางเลือก 3 ของ ADR-007)
· ADR-023 (webhook endpoint เดียว `/hooks/payment/stripe_stripe`) ยังมีผลทั้งหมด

## บริบท
- อาการ (ทดสอบด้วยมือบน `615b9cde`, 2026-11-29): ลูกค้าจ่ายด้วยบัตรแล้ว **เพิ่ม/แก้ที่อยู่ ชื่อ หรือเบอร์ภายใน 24 ชม.** → เลือกพร้อมเพย์ได้ 500 (ทิศกลับกันก็เป็น — พร้อมเพย์ก่อนแล้วบัตร); บัตรยังจ่ายได้
- **เป็น bug ของ Medusa ไม่ใช่ของเรา** — รายงานไว้ที่ v2.8.2 [medusajs/medusa#12526](https://github.com/medusajs/medusa/issues/12526)
  ("Bancontact payment for Stripe Customer that already ordered with Credit Card") — bot ปิดเพราะไม่มีความเคลื่อนไหว (closed as not planned) ไม่มี PR แก้;
  develop ของ Medusa ยังเรียก `customers.create` ใหม่ทุกครั้งที่ provider นั้นยังไม่มี account holder
- ต้นเหตุ (ตรวจ source 2.22.1 ใน `node_modules`):
  1. `@medusajs/core-flows` `dist/payment-collection/workflows/create-payment-session.js:67–69` หา account holder ของลูกค้า**แยกต่อ provider**
     (`account_holders.find(ac => ac.provider_id === input.provider_id)`) → ลูกค้าที่มี holder ของ `pp_stripe_stripe` แล้ว ยังไม่มีของ `pp_stripe-promptpay_stripe`
     จึงเรียก `createPaymentAccountHolderStep` (`noCompensation: true`)
  2. `@medusajs/payment` `dist/services/payment-module.js:690–713` `createAccountHolder` ส่ง `idempotency_key: input.context?.customer?.id` — **ค่าเดียวกันทุก provider**
  3. `@medusajs/payment-stripe` `dist/core/stripe-base.js:261–300` `createAccountHolder` เรียก `stripe.customers.create({ email, name, phone, shipping }, { idempotencyKey })`
     โดย `shipping` มาจาก `customer.billing_address` (default billing หรือที่อยู่แรก — `create-payment-session.js:60–66`)
  4. ภายใน 24 ชม. Stripe ปฏิเสธ request ที่ใช้ idempotency key เดิมแต่พารามิเตอร์ต่าง → ตอนจ่ายบัตรลูกค้ายังไม่มีที่อยู่ (`shipping` ไม่มี) พอเพิ่มที่อยู่แล้วเลือกพร้อมเพย์ → error
- **ไม่ใช่ regression**: pin 2.22.1 ตั้งแต่ CORE-1 จึงอยู่ใน v0.1.0–v0.3.1 ด้วย; ไม่เคยเจอเพราะ e2e `core-19f` สลับวิธีจ่ายโดยไม่เปลี่ยนข้อมูลลูกค้า และ integration
  mock `Stripe.resources.Customers.prototype.create` ให้คืนค่าเดิมเสมอ (เช่น `integration-tests/http/payment-collection-reset.spec.ts:79–81`)
- ทุกวันนี้ "โดยบังเอิญ" ลูกค้าที่ไม่ได้แก้ข้อมูลได้ Stripe customer **ตัวเดียว** ทั้งสองวิธี (Stripe คืนผลเดิมของ key เดิม) — owner เลือกให้เป็นพฤติกรรมตั้งใจ
- ข้อมูลอื่นที่ตรวจ:
  - account holder unique ที่ `(provider_id, external_id)` (`@medusajs/payment` `dist/models/account-holder.js:13–18`) → holder สองแถว (ต่าง provider) ชี้ `cus_…` เดียวกันได้
  - `deleteAccountHolder` ของ provider (`stripe-base.js:342–354` — `stripe.customers.del`) ใน 2.22.1 ถูกเรียกจาก compensation ของ `createPaymentAccountHolderStep` เท่านั้น
    (`core-flows` `dist/payment-collection/steps/create-payment-account-holder.js:35`) ซึ่ง workflow สร้าง session ปิดไว้ (`noCompensation: true`); ลบ customer ของ Medusa ไม่ลบ account holder
  - `@medusajs/payment-stripe/dist/index.js` export เฉพาะ default (`ModuleProvider(Modules.PAYMENT, { services })`); class ของ provider อยู่ที่ `dist/services/index.js`
    (`StripeProviderService` identifier `stripe`, `StripePromptpayService` identifier `stripe-promptpay`); package ไม่มี field `exports` จึง import `dist/services` ได้
  - `@medusajs/medusa/payment-stripe` (`@medusajs/medusa` `dist/modules/payment-stripe.js`) re-export เฉพาะ export ของ index → **ไม่มี class ให้ subclass**;
    `@medusajs/payment-stripe` เป็น dependency ของ `@medusajs/medusa` (pnpm ไม่ hoist ให้ `apps/backend`) → ต้องประกาศใน `apps/backend/package.json` ถึงจะ import ได้
  - provider id = `pp_<identifier>_<id ใน medusa-config>` → คง identifier เดิม + `id: 'stripe'` ได้ id เดิม `pp_stripe_stripe`, `pp_stripe-promptpay_stripe` (region, payment session เก่า, webhook ไม่เปลี่ยน)
  - medusajs.com/integrations: Stripe ทางการคือ provider ตัวนี้เอง ไม่มี plugin อื่นที่แก้เรื่องนี้

## ทางเลือก
- **ก (owner เลือก) Stripe customer เดียวต่อลูกค้า** — payment provider module ของเรา `src/modules/stripe-shared-customer/` ที่ subclass `StripeProviderService` และ `StripePromptpayService`
  คง `identifier` + `id: 'stripe'` + options เดิม override **เฉพาะ `createAccountHolder`**:
  (1) ถ้า `context.customer.account_holders` มี holder ของ **อีก** Stripe provider (`pp_stripe_stripe` ↔ `pp_stripe-promptpay_stripe`) ที่มี `data.id` → คืน `{ id: data.id, data }` ของ holder นั้น (ไม่เรียก Stripe);
  (2) ไม่งั้น `super.createAccountHolder` ด้วย `idempotency_key` = `` `${customer.id}:${identifier}` `` (key ไม่ซ้ำข้าม provider — ถ้าสองวิธีถูกสร้างพร้อมกันครั้งแรกจะได้ 2 customer แต่ไม่ error)
  ผล: บัตร/พร้อมเพย์ใช้ `cus_…` เดียวกัน; ประวัติลูกค้าใน Stripe รวมที่เดียว
- ข Stripe customer แยกต่อ provider — override แค่ key เป็น `${customer.id}:${identifier}` → ไม่ error แต่ลูกค้าหนึ่งคนมี 2 customer ใน Stripe (ต่างจากที่ระบบทำอยู่โดยบังเอิญ) → ไม่เลือก
- ค patch `node_modules`/fork Medusa หรือ bump Medusa — upstream ยังไม่แก้ (#12526 ปิดโดยไม่แก้) และ patch ขัดกฎ "pin + bump ผ่าน ADR" → ไม่เลือก
- ง hook/workflow ของเราสร้าง account holder ก่อนเรียก `createPaymentSessionsWorkflow` — route `POST /store/payment-collections/:id/payment-sessions` เป็นของ Medusa (ต้อง middleware/route ใหม่ + ทำซ้ำ logic ของ module) → ซับซ้อนกว่า ไม่เลือก

## การตัดสินใจ
ทาง **ก**:
1. `src/modules/stripe-shared-customer/index.ts` = `ModuleProvider(Modules.PAYMENT, { services: [SharedStripeProviderService, SharedStripePromptpayService] })` (convention module provider ของ Medusa)
   — class สืบทอดจาก `StripeProviderService`/`StripePromptpayService` ของ `@medusajs/payment-stripe/dist/services`, `static identifier` เท่าเดิม (`stripe`, `stripe-promptpay`)
2. `medusa-config.ts` (`:72–89`): provider `resolve: './src/modules/stripe-shared-customer'`, `id: 'stripe'`, options เดิมทุกตัว (`apiKey`, `webhookSecret`, `capture: true`, `automaticPaymentMethods: false`)
3. override เฉพาะ `createAccountHolder` ตามทาง ก ข้อ (1)(2); logic เลือก holder เป็น pure function (unit test ได้); ไม่แตะ method อื่น
4. **dependency**: เพิ่ม `"@medusajs/payment-stripe": "2.22.1"` (pin ตรงกับ `@medusajs/*` อื่น) ใน `apps/backend/package.json` — เป็น package เดียวกับที่ติดตั้งอยู่แล้วใต้
   `@medusajs/medusa` (lockfile ไม่ดาวน์โหลดใหม่; publish นานแล้ว ไม่ติด `minimumReleaseAge`) · ไม่เพิ่ม `stripe` ตรง
5. ไม่ย้าย/รวม Stripe customer ของลูกค้าเดิมที่มี 2 ตัวอยู่แล้ว (ร้านยังไม่ go-live; holder ที่มีแล้วถูก reuse ตามเดิมโดย `create-payment-session.js:67–75`)
6. **เงื่อนไขถอด**: เมื่อ bump Medusa (ผ่าน ADR) ให้ตรวจว่า upstream ใช้ idempotency key ต่อ provider หรือ reuse customer ข้าม provider แล้วหรือไม่
   (`payment-module.js` `createAccountHolder` + `stripe-base.js` `createAccountHolder`) — ถ้าแก้แล้ว: กลับไป `resolve: '@medusajs/medusa/payment-stripe'`, ลบ module นี้และ dependency
   ในข้อ 4 แต่**คง integration test ของ AC-198** ไว้เป็นตัวกัน regression

## ผลที่ตามมา
+ ลูกค้าสลับบัตร ↔ พร้อมเพย์ได้เสมอแม้แก้ที่อยู่/ชื่อ/เบอร์ · Stripe customer เดียวต่อลูกค้า (refund/ประวัติดูที่เดียว)
+ provider id, webhook, region, payment session เดิมไม่เปลี่ยน — ไม่มี migration
− เรามีโค้ดที่สืบทอดจาก class ภายในของ Medusa (`dist/services`) — bump Medusa ต้องรัน test ของ AC-198 และตรวจ signature ของ `createAccountHolder` ทุกครั้ง
− dependency ใหม่ใน `apps/backend/package.json` 1 ตัว (package เดิมของ Medusa)
− **ข้อควรระวัง**: `deleteAccountHolder` ของ provider ลบ `cus_…` ใน Stripe — เมื่อใช้ร่วมสอง holder การลบ holder หนึ่งจะทำให้อีก holder ชี้ customer ที่ถูกลบ;
  2.22.1 ไม่มี flow ที่เรียก (ข้อมูลในบริบท) และเราไม่มี flow ลบ — ถ้าอนาคตเพิ่ม flow ลบ account holder/ลบลูกค้าที่ลบ holder ให้ override `deleteAccountHolder`
  (ลบ customer เมื่อไม่มี holder อื่นใช้แล้วเท่านั้น) ใน task นั้น
− `updateAccountHolder` (ถ้า Medusa เรียกในอนาคต) จะอัปเดต customer ตัวเดียวกันของทั้งสองวิธี — ตรงตามเจตนา "customer เดียว"

## แหล่งอ้างอิง (ตรวจ 2026-11-29, Medusa 2.22.1 ใน `node_modules/.pnpm`)
- `@medusajs/core-flows/dist/payment-collection/workflows/create-payment-session.js:41–100` · `…/steps/create-payment-account-holder.js:31–35`
- `@medusajs/payment/dist/services/payment-module.js:690–713` · `@medusajs/payment/dist/models/account-holder.js:13–18`
- `@medusajs/payment-stripe/dist/core/stripe-base.js:261–354` · `…/dist/services/{index,stripe-provider,stripe-promptpay}.js` · `…/dist/index.js` · `…/package.json` (ไม่มี `exports`)
- `@medusajs/medusa/dist/modules/payment-stripe.js` (re-export เฉพาะ index) · https://github.com/medusajs/medusa/issues/12526
- Medusa docs: Payment Module Provider (`ModuleProvider(Modules.PAYMENT, { services })`, provider id `pp_{identifier}_{id}`) — https://docs.medusajs.com/resources/references/payment/provider
