# ADR-028 storefront ตัดสิน error ของ Store API ด้วย `code`/`type` แทนการเทียบข้อความ

สถานะ: **accepted** (owner ตัดสิน 2026-11-21 — ทางเลือก 2 + 3: helper ของเรา + เปิด issue upstream; CORE-82..84 เป็น 3 PR ปิดท้ายรอบ 41; spec 01 กฎข้อ 140, Q-C14; เสนอโดย planner รอบ 41)
เลข: ADR-027 สงวนไว้ให้ ADR วิธี deploy/staging (spec 07 หัวข้อรอบ 40) จึงใช้ 028
เกี่ยวข้อง: spec 01 กฎข้อ 69/72/106/129/131, spec 03 กฎข้อ 27, spec 06 กฎข้อ 11, error handler ของ PROMO-2 (`apps/backend/src/api/error-handler.ts` allow-list ของ `code`)

## บริบท
- backend ตอบ error เป็น `{ type, code?, message }` (Medusa + allow-list ของเรา) แต่ `@medusajs/js-sdk` 2.22.1 `normalizeResponse` อ่าน body แล้ว throw
  `new FetchError(message, statusText, status)` (`dist/esm/client.js:96-112`) — **`code`/`type` หายไป** และ body ถูกอ่านแล้ว อ่านซ้ำไม่ได้;
  client ใช้ `fetch` ของ global ไม่มี option ส่ง fetch หรือ interceptor ของ response (`client.js:305-308`)
- storefront จึงเทียบ**ข้อความภาษาอังกฤษ**ของ backend/Medusa (`CHECKOUT_CONFLICTS`, `RETURN_ERRORS`, `insufficient-inventory.ts`, `Identity with email already exists` ฯลฯ)
  + contract test ที่เทียบ constant กับ backend + เช็กลิสต์ bump (spec 07 ข้อ 8, 13) — เปราะเมื่อ Medusa แก้ถ้อยคำ และข้อความของ Medusa ที่ไม่มี code (เช่นสต็อกไม่พอตอน complete) ต้องเทียบ prefix
- review CORE-71 เสนอเปลี่ยนเป็น code ทีเดียว; owner สั่งทำในรอบนี้

## ทางเลือก
1. **คงเดิม** — เทียบข้อความ + contract test + เช็กลิสต์ bump; ไม่มีงาน; เปราะตามบริบท
2. **helper ของเราเรียก Store API ที่ต้องรู้ code ด้วย `fetch` ตรง** (`lib/data/medusa-fetch.ts`): base URL/publishable key จาก `@lib/config`, auth header จาก `getAuthHeaders()` เดิม,
   cache/next tags แบบเดียวกับที่ใช้กับ `sdk.client.fetch`; error → `MedusaApiError { status, type, code, message }`; ใช้เฉพาะ mutation ที่ตัดสินจาก error (complete cart, payment sessions, returns, register, join group ฯลฯ)
   — ข้อดี: ได้ code ทันทีโดยไม่ patch library; ข้อเสีย: มี client ทางที่สองคู่กับ SDK (ต้องเหมือนกันเรื่อง header/locale/credentials — unit เทียบ header กับ SDK), ย้ายผู้เรียกทีละกลุ่ม 3 PR
3. **รายงาน upstream ให้ `FetchError` เก็บ `code`/`type`** แล้วรอ bump — ไม่มีโค้ดของเรา แต่ไม่ทันรอบนี้และไม่รู้เวลา
4. **backend ใส่ code ใน `message`** (เช่น `FLASH_SOLD_OUT: …`) — ไม่ต้องแก้ client แต่เปลี่ยนสัญญา API ที่ admin/client อื่นเห็น และยังเป็นการ parse ข้อความ — ไม่แนะนำ
5. `pnpm patch` `@medusajs/js-sdk` ให้ส่งต่อ `code`/`type` — ขัดหลัก "ไม่ patch library", ต้องตรวจทุก bump — ไม่แนะนำ

## การตัดสินใจ (owner 2026-11-21: 2 + 3)
- ทำทางเลือก 2 เป็น helper เดียว (ไม่สร้าง abstraction อื่น) และเปิด issue upstream (3); เมื่อ bump แล้ว `FetchError` มี `code` → ย้ายกลับไปใช้ SDK แล้วลบ helper (เพิ่มในเช็กลิสต์ bump ของ spec 07)
- storefront มี client ทางที่สองอยู่แล้ว: `createPaymentSession` (`apps/storefront/src/lib/data/payment.ts`) ที่ `fetch` ตรงด้วยเหตุผลเดียวกัน (`FetchError` ไม่มี `code`) — CORE-82 ย้ายตัวนี้เข้า `medusa-fetch.ts` ด้วย (ไม่ให้มีสามทาง; review #467)
- แบ่งงาน: CORE-82 = helper + กลุ่ม checkout/cart/payment (รวม `createPaymentSession`); CORE-83 = account/returns/auth; CORE-84 = group buy/flash/affiliate — แต่ละ PR ลบ map ข้อความและ contract test ของกลุ่มนั้นเปลี่ยนเป็นเทียบ code
- Medusa core error ที่**ไม่มี** code (เช่น `Not enough stock available …`, `Identity with email already exists`) ยังเทียบ `type` + ข้อความตามเดิม (ไม่มีทางอื่น) — บันทึกเป็นข้อยกเว้นใน helper

## ผลที่ตามมา
- ข้อความไทยที่ลูกค้าเห็นไม่เปลี่ยน; test ตรวจ code ไม่ใช่ข้อความอังกฤษ
- client ทางที่สองต้องดูแลคู่กับ SDK จนกว่า upstream แก้ (unit เทียบ header ทุกครั้งที่ bump)
- issue upstream: session หลักเปิด (owner อนุมัติ 2026-11-21) — เพิ่มในเช็กลิสต์ bump ของ spec 07: ถ้า `FetchError` มี `code`/`type` แล้ว ย้ายกลับไปใช้ SDK และลบ helper

## ภาคผนวก 2026-11-23 (สถานะ upstream — owner ตัดสินยังไม่เปิด issue)
- ตรวจ `@medusajs/js-sdk` **2.23.0** (latest ณ 2026-11-22): `normalizeResponse` ยัง `throw new FetchError(message, statusText, status)` (`dist/esm/client.js:97-99`) และ `FetchError` มีแค่ `message`/`statusText`/`status` (`:108-114`) — ปัญหาเดิมยังอยู่ ไม่มี option ส่ง `fetch` หรือ interceptor
- มีผู้รายงานแล้วแต่ถูกปิดโดยไม่แก้:
  - issue medusajs/medusa#16770 "JS SDK drops code and type from API error responses" (label `type: bug`) — ปิด not planned 2026-09-28 เพราะ stale
  - issue medusajs/medusa#16876 — ปิด 2026-09-19 เป็น duplicate ของ #16770
  - PR medusajs/medusa#16769 `fix(js-sdk): preserve code and type…` — ปิดไม่ merge (stale)
  - PR medusajs/medusa#16955 `fix(medusa-js): forward code and type…` — ปิดไม่ merge (ไม่ link issue ที่เปิดอยู่ตามกติกา repo)
- owner ตัดสิน 2026-11-23: **ยังไม่เปิด issue/comment upstream** (แทนข้อ "issue upstream: session หลักเปิด" ในผลที่ตามมา) — ใช้ helper ของ CORE-82 (`lib/data/medusa-fetch.ts`) ต่อ; ร่างข้อความ issue อยู่ใน body ของ PR #514 ถ้าจะเปิดภายหลังให้ comment/อ้าง #16770 แทนการเปิดซ้ำ และต้องถาม owner ก่อน
- เช็กลิสต์ bump ข้อ 16 ของ spec 07 ยังใช้ตามเดิม: ทุกครั้งที่ bump Medusa ตรวจ `FetchError` ว่ามี `code`/`type` หรือยัง
