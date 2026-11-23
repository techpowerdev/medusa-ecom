# QA CORE-83 (PR #517) — จับ error กลุ่ม account/returns/auth ด้วย code

- spec: `docs/spec/01-core-medusa.md` กฎข้อ 140, AC-181 (b) กลุ่ม account/returns/auth; ADR-028
- commit ที่ตรวจ: `ffe4291e4ee970b8da5ef4a46bf23347f5aa0c66` (worktree แบบ detached)
- สภาพแวดล้อม: prod build — backend `NODE_ENV=production medusa build` + `medusa start` จาก `.medusa/server`, storefront `next build` + `next start` :8259, DB `medusa_qa517`, Redis db 11, `pp_system_default`, viewport 375px
- backend จริงอยู่ที่ :9269 หลัง proxy ส่งผ่านของ qa ที่ :9259 ซึ่งบันทึกผลของ `POST /store/returns`/register; เฉพาะ QA-RT1 proxy ย้อน `shipped_at` ใน DB ก่อนส่ง `POST /store/returns` ต่อ (storefront ตรวจช่วงคืนผ่านไปแล้ว) เพื่อให้ backend จริงตอบ `RETURN_WINDOW_EXPIRED` ผ่าน `medusaFetch` โดยไม่ mock
- test ของ qa (ไม่ commit) 8/8 ผ่าน; e2e เดิมที่เกี่ยวข้อง 17/17 ผ่าน
- report/trace ฉบับเต็ม: CI artifact ของ run https://github.com/techpowerdev/medusa-ecom/actions/runs/45165977199 (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-181 (b) สมัครด้วยอีเมลที่มีบัญชีแล้ว → `register-email-exists` + `register-login-link` ไทย ไม่ login (QA-R1, core-73, core-4f) | pass | qa517-01-register-email-exists-375.png |
| AC-181 (b) อีเมลที่มี identity แต่ไม่มี customer (affiliate) → สมัครแล้ว login เป็นลูกค้า, customer 1 ราย (QA-R2, core-73 regression) | pass | ผล test QA-R2 + core-73 |
| AC-181 (b) สมัครอีเมลใหม่ / login รหัสผิด `อีเมลหรือรหัสผ่านไม่ถูกต้อง` คงอีเมล / login ปกติ (QA-R3, core-4f, core-4h) | pass | qa517-02-login-wrong-password-375.png |
| AC-181 (b) คืนเลยช่วงคืน — backend จริงตอบ 400 `code: RETURN_WINDOW_EXPIRED` → `return-error` = `เลยระยะเวลาที่ขอคืนสินค้าได้แล้ว` จำนวน 2 คงอยู่ ปุ่มกดได้ ไม่สร้าง return (QA-RT1) | pass | qa517-03-return-window-expired-375.png |
| AC-181 (b) location ไม่มีของ — backend ตอบ 400 `{type: invalid_data, code: RETURN_ITEM_NOT_STOCKED}` (UI และ API ตรง) → `return-contact-store` ไทย + ลิงก์ `/th/contact` ไม่มี `return-error` (QA-RT2, core-71) | pass | qa517-04-return-not-stocked-contact-375.png |
| AC-181 (b) คืนสินค้าปกติ → `order-return-success` ไทย, return `requested` 1 รายการ (QA-RT3, core-20, core-55) | pass | qa517-05-return-success-375.png |
| token ไม่รั่วข้าม session: 2 context สมัครพร้อมกัน + context ที่สามไม่เคย login สลับโหลด 2 รอบ, หน้าโปรไฟล์แสดงอีเมลตัวเองเท่านั้น (QA-T1) | pass | ผล test QA-T1 |

## edge / negative
| กรณี | ผล |
|------|----|
| dblclick สมัคร (อีเมลใหม่) | pass — customer 1 ราย ไม่มี `register-error` (QA-E1) |
| dblclick ส่งคำขอคืน | pass — `POST /store/returns` ถึง backend 1 ครั้ง, return 1 รายการ (QA-E2) |
| 375px | pass — test ของ qa ทั้งหมดรันที่ 375×812 |
| ข้อความ error: มีอักษรไทย ไม่มี `[A-Za-z]{4,}` ทั้งหน้าไม่มีข้อความอังกฤษของ backend | pass — register-email-exists, login-error-message, return-error, return-contact-store, order-return-success |

## defect / ข้อสังเกต
- D1 (test ไม่กระทบผู้ใช้): `apps/storefront/e2e/core-20d-return-window.spec.ts` AC-102 (c, e) ไม่พิสูจน์ข้อความของ RETURN_WINDOW_EXPIRED แล้ว — `expected = returnErrorMessage(Object.assign(new Error(<ข้อความ backend>), { status: 400 }), fallback)` หลัง PR นี้ได้ fallback `ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง` (เพราะตัดสินเฉพาะ `MedusaApiError` ที่มี code) test จึง mock ข้อความ fallback แล้วผ่านเสมอ ควรสร้าง `new MedusaApiError({ status: 400, type: "invalid_data", code: "RETURN_WINDOW_EXPIRED", message })` แทน และ `backendWindowExpiredMessage()` ไม่จำเป็นแล้ว
- nit: comment ใน core-71/core-20d ยังอ้าง "FetchError 400"

## รอบ 2 (head `5fb65a6f`)
- D1 แก้แล้ว: `core-20d-return-window.spec.ts` สร้าง `expected` จาก `MedusaApiError` code `RETURN_WINDOW_EXPIRED` + assert ≠ fallback, ลบ `backendWindowExpiredMessage`; builder ยืนยัน red (assert ใหม่กับ expected เดิม) และ mutation (เปลี่ยน code ใน `RETURN_ERRORS` → e2e แดง) กับ backend จริง; reviewer re-review APPROVE และ CI ทุก job SUCCESS
- การเปลี่ยนแปลงรอบ 2 อยู่ใน test และการเทียบ `IDENTITY_EXISTS` แบบเท่ากันเท่านั้น — พฤติกรรมที่ผู้ใช้เห็นไม่เปลี่ยนจากรอบ 1 จึงไม่ re-test UI
