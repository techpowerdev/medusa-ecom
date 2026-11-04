# QA CORE-37 — `CopyButton`: ค่าที่ให้คัดลอกเอง, Web Share ล้มแล้วคัดลอกต่อ, แถวรหัส voucher (PR #265)

spec: `docs/spec/01-core-medusa.md` กฎข้อ 95, AC-131 — ตรวจบน prod build (`medusa build`/`medusa start` + `next build`/`next start`) ที่ commit `7eb4901` ที่ 1280px และ 375px หา element ด้วย `data-testid` และตรวจข้อความไทยด้วย regex `[฀-๿]`

| AC | Result | Evidence |
|----|--------|----------|
| AC-131 unit (writeText reject → `-value`, share `NotAllowedError` → writeText 1 ครั้ง, `AbortError` → 0 ครั้ง) | pass | `core-31-copy-button.test.ts` 11/11 (storefront unit ทั้งชุด 824/824) |
| AC-131 / 95c การ์ด voucher 1280: คัดลอกสำเร็จ ปุ่มไม่ขยับ อยู่แนวเดียวกับรหัส | pass | qa-01-voucher-copied-1280.png — clipboard จริงตรงกับ `voucher-code`, ตำแหน่งปุ่มก่อน/หลัง dx=0 dy=0, y-center ของรหัสกับปุ่มต่างกัน 0px; คัดลอกล้มที่ 1280 ปุ่มก็ไม่ขยับ (dy=0) |
| AC-131 / 95a voucher 375: writeText reject | pass | `voucher-copy-status-value` มีตัวเดียว ค่าตรงกับรหัส, `word-break: normal`, `overflow-wrap: anywhere`, `user-select: all` (triple-click เลือกได้ทั้งก้อน); ข้อความนำ "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง" อยู่นอก element ค่า; `scrollWidth` = 375; ปุ่ม dy=0 |
| 95a ค่ายาวที่ไม่มีช่องว่าง (เคสเพิ่มจาก review) | pass | qa-02-voucher-long-fail-375.png — voucher code 80 ตัวไม่มีช่องว่าง: element ค่าตัดเป็น 2 บรรทัด, ขอบขวาของค่า 334 ไม่เกินขอบการ์ด 351, `scrollWidth` = 375; คัดลอกสำเร็จได้ค่าครบ 80 ตัว |
| 95b affiliate การ์ด Products: share reject `NotAllowedError` → คัดลอกแทน | pass | qa-03-affiliate-share-deny-fail-375.png — share 1 ครั้งแล้ว writeText 1 ครั้งด้วย URL absolute เดิม → "คัดลอกลิงก์แล้ว" และ clipboard จริงตรง; ถ้า writeText ล้มด้วย → ข้อความล้ม + `affiliate-share-status-value` (URL ยาว 72 ตัวที่ 375 ตัดในการ์ด, `scrollWidth` = 375) |
| 95b share reject `AbortError` → เงียบ / share สำเร็จ → ไม่คัดลอก | pass | writeText 0 ครั้ง, สถานะว่าง, ปุ่มกลับมา enabled (ผลจาก test log) |
| affiliate Profile 1280/375 | pass | qa-04-affiliate-profile-fail-375.png — คัดลอกสำเร็จ (clipboard ตรง `/r/<code>`), ล้มแล้วได้ `affiliate-default-link-status-value` ที่ตัดบรรทัดได้ (ดู O-2) |
| หน้ากลุ่ม `/th/g/<token>` 1280/375 | pass | qa-05-group-fail-375.png — คัดลอกสำเร็จ (clipboard ตรง URL ของกลุ่ม), ล้มแล้วได้ `group-share-copy-status-value`, `scrollWidth` = 375, ปุ่มไม่ขยับ |

## Negative / edge
- **กดรัว** (2–3 คลิกในจังหวะเดียวขณะ writeText ช้า 800ms) บนการ์ด voucher, Profile และหน้ากลุ่ม: writeText ถูกเรียก 1 ครั้ง ปุ่ม disabled ระหว่างทำงานแล้วกลับมา enabled — pass
- **ล้มแล้วกดคัดลอกใหม่จนสำเร็จ**: สถานะเปลี่ยนเป็น "คัดลอกแล้ว" และ element `-value` หายไป — pass
- **share ล้มแล้ว clipboard ล้มต่อ**: เรียก writeText 1 ครั้งแล้วแสดงข้อความล้มแบบข้อ (a) — pass
- **regression**: e2e `core-37-copy-button`, `evoucher-storefront`, `affiliate-portal`, `affiliate-portal-pages`, `affiliate-portal-polish`, `group-buy-group-page` ผ่าน 13/13 (e2e เดิมของ AC-124 ผ่านโดยไม่แก้ locator)

## Defect
ไม่พบ

## Observation
- **O-1**: แถวรหัสของการ์ด voucher มีช่องว่าง 4px ใต้แถวตลอดเวลา เพราะ span สถานะที่ว่าง (`basis-full`, สูง 0px) ขึ้นบรรทัดใหม่ใน flex-wrap ที่มี `gap-y-1` ไม่ขัดกฎข้อ 95c แก้ได้โดยซ่อน span เมื่อไม่มีสถานะ (คง span ไว้ใน DOM เพื่อ `aria-live`) หรือย้าย gap ไปไว้ที่ span
- **O-2 (ปัญหาเดิม อยู่นอก PR นี้)**: หน้า Profile ของ affiliate ที่ 375 บางรอบมี `scrollWidth` 378–380 (2 ใน 9 รอบ) เกิดตั้งแต่ก่อนคลิก ต้นเหตุคือ `<dl className="grid grid-cols-[max-content_1fr]">` ใน `affiliate/profile/page.tsx` ซึ่ง `1fr` มีค่าต่ำสุดเป็น min-content ทำให้อีเมลยาวไม่มีช่องว่างดันทุก `<dd>` ออกไป เสนอ follow-up ใช้ `minmax(0,1fr)` + `break-words` ที่ `<dd>`
- **O-3**: การ์ด Products ที่ 375 แคบ (คอลัมน์ข้อความกว้างประมาณ 117px) URL ยาว 72 ตัวจึงตัดเป็น 6 บรรทัด ไม่ล้นจอและอ่านได้ เป็น layout ของการ์ดเดิม

## สรุป
AC-131 และกฎข้อ 95 (a)(b)(c) ผ่านทั้ง unit และมุมผู้ใช้บน prod build ทั้งที่ 1280 และ 375 บนหน้า `/th/account/vouchers`, affiliate portal (การ์ด Products, Profile) และ `/th/g/<token>` รวมถึงเคสค่ายาว 80 ตัวไม่มีช่องว่าง ไม่พบ defect
