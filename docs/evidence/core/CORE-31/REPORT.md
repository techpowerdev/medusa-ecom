# CORE-31 — QA ปุ่มคัดลอกกลาง (PR #254, spec 01 กฎข้อ 88 / AC-124)
ทดสอบบน prod build ที่ commit `55b7b42` ที่ความกว้าง 1280px และ 375px หา element ด้วย `data-testid` ตรวจความเป็นไทยด้วย `[฀-๿]` และอ่าน clipboard จริงหลังเรียก `grantPermissions(['clipboard-read','clipboard-write'])`

| AC | Result | Evidence |
|----|--------|----------|
| AC-124 grep: `navigator.clipboard.writeText` อยู่ไฟล์เดียวใต้ `src/modules` | pass | grep ใต้ `src/modules`, `src/app`, `src/lib` พบไฟล์เดียวคือ `common/components/copy-button/index.tsx` |
| AC-124 unit (กดสองครั้งใน `act()` เดียว / resolve / reject / Share→URL absolute) | pass | `vitest src/core-31-copy-button.test.ts` ผ่าน 7/7 |
| AC-124 ปุ่ม voucher (`voucher-copy-button`, หน้าบัตรกำนัลของฉัน) | pass | qa-01-voucher-copied-1280.png, qa-02-voucher-fail-375.png |
| AC-124 การ์ด Products ของ affiliate (`affiliate-share-button`): ไม่มี Web Share → คัดลอก | pass | qa-03-affiliate-card-copied-1280.png |
| AC-124 Profile ของ affiliate (`affiliate-default-link-copy`) | pass | qa-04-affiliate-profile-375.png |
| AC-124 หน้ากลุ่ม `/th/g/<token>` (`group-share-copy`) | pass | qa-05-group-fail-375.png |
| AC-124 e2e เดิมผ่านโดยไม่แก้ locator: EV-7b, AF-8a/8b, GB-7a1 | pass | 4 ไฟล์ (`evoucher-storefront`, `affiliate-portal`, `affiliate-portal-pages`, `group-buy-group-page`) ผ่าน 11/11 |

ทั้งสามจุดทดสอบด้วยชุดเดียวกันใน e2e ของ QA (ชั่วคราว ไม่ได้ commit) ผ่าน 3/3:
- **คัดลอกสำเร็จ**: ค่าใน clipboard ตรงกับที่คาด — voucher ได้ code ตรงตัว, การ์ด affiliate ได้ `<origin>/r/<code>?to=/products/sweatshirt`, Profile ได้ `<origin>/r/<code>`, หน้ากลุ่มได้ `<origin>/g/<token>`; URL ทั้งหมดเป็น absolute และสถานะเป็นไทย ("คัดลอกแล้ว" / "คัดลอกลิงก์แล้ว")
- **กดซ้ำเร็วๆ**: ทำให้ writeText ช้าลง 800ms แล้วคลิก 2 ครั้งใน tick เดียว ได้ writeText 1 ครั้ง ปุ่ม disabled ระหว่างทำงาน และกดได้อีกเมื่อเสร็จ
- **คัดลอกล้ม** (override `writeText` ให้ reject `NotAllowedError`): ขึ้น "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง: <ค่า>" ซึ่งมีค่าครบและเป็นไทย
- **375px**: ไม่มีการเลื่อนแนวนอน (`scrollWidth ≤ 375`) แม้ข้อความล้มจะยาว

## Negative/edge
- **มี Web Share (mock)**: เรียก `navigator.share` 1 ครั้งด้วย URL absolute และไม่เรียก writeText สถานะว่าง — pass
- **Web Share ล้มด้วย `AbortError`** (ผู้ใช้ปิดหน้าต่างแชร์เอง): สถานะว่างและปุ่มกดได้อีก — pass
- **Web Share ล้มด้วย `NotAllowedError`**: ขึ้น "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง: <url>" โดยไม่ลองคัดลอกแทน (writeText 0 ครั้ง) เหมือนพฤติกรรมเดิมก่อน PR นี้ ไม่ใช่ regression
- **URL relative → absolute บนเบราว์เซอร์จริง**: ไม่ได้ทดสอบ เพราะ backend ตั้ง `STOREFRONT_URL` และหน้ากลุ่ม/Profile ประกอบ origin ฝั่ง server จึงได้ URL absolute ตั้งแต่ต้นทาง กรณีนี้มีแค่ unit test ครอบ

## Defect
ไม่พบ

## Observation (มุมผู้ใช้)
1. **ปุ่ม voucher**: เดิมข้อความบนปุ่มเปลี่ยนเป็น "คัดลอกแล้ว"/"คัดลอกไม่สำเร็จ" ตอนนี้ปุ่มคงข้อความ "คัดลอกรหัส" และสถานะไปขึ้นใต้ปุ่มใน `voucher-copy-status` (qa-01) ผู้ใช้ยังเห็นผลชัด (`aria-live="polite"`) และหน้าตาเหมือนปุ่มแชร์อื่น — reviewer ตัดสินว่าไม่ขัดกฎข้อ 88 (label กับข้อความสถานะเป็นคนละ prop) ถ้าต้องการให้ป้ายปุ่มเปลี่ยนเหมือนเดิมต้องระบุใน spec
2. **ขนาดปุ่ม voucher**: เปลี่ยนจาก medium เป็น `size="small"` ที่ 1280px เห็นปุ่มเล็กลง ส่วนที่ 375px ปุ่มกว้างเต็มการ์ด (qa-02)
3. **ข้อความล้มที่ 375px**: ค่าที่ให้คัดลอกเองถูกตัดขึ้นบรรทัดกลางคำเพราะ `break-all` (qa-02, qa-05) และอยู่ในประโยคเดียวกับข้อความนำ ผู้ใช้ต้องลากเลือกเฉพาะส่วนค่าเอง — หน้า voucher มีรหัสแสดงแยกใน `voucher-code` และหน้ากลุ่มมี `group-share-link` อยู่แล้ว เป็นข้อปรับปรุงได้ ไม่ใช่ defect
4. **ข้อความล้มของ `ShareLinkButton`**: เปลี่ยนจาก "คัดลอกไม่สำเร็จ ลิงก์: <url>" เป็น "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง: <url>" ตรงกับกฎข้อ 88 — กรณี Web Share ล้ม (ไม่ใช่การคัดลอกล้ม) ก็ขึ้นคำว่า "คัดลอกไม่สำเร็จ" เหมือนกัน (พฤติกรรมเดิม)
5. **ปุ่มคัดลอกของ e-voucher**: มีที่เดียวคือหน้า `/th/account/vouchers` หน้า order ไม่มีปุ่มคัดลอก

## สรุป
AC-124 ผ่านทุกข้อบน prod build ทั้งที่ 1280px และ 375px ไม่พบ defect
