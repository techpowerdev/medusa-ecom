# QA Evidence — CORE-40: ช่องโค้ดส่วนลดมี action ค้างได้ทีละหนึ่ง (PR #275)

spec: `docs/spec/01-core-medusa.md` กฎข้อ 98, AC-134 · build: prod (`medusa build` / `medusa start` และ `next build` / `next start`) · commit `78f5b87`
ทดสอบหน้า `/th/cart` และ `/th/checkout` ที่ความกว้าง 1280px และ 375px · หา element ด้วย `data-testid` · ตรวจข้อความไทยด้วย regex `[฀-๿]`
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #275 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-134 unit (Vitest): ลบค้างแล้วปุ่มใส่ disabled, ส่งฟอร์มไม่ยิง action, ลบสำเร็จโดย prop ไม่ refresh แล้วใส่ B ได้ `["B"]`, ลบล้มแล้วใส่ B ได้ `["A","B"]`, ใส่ค้างแล้วปุ่มลบ disabled | pass | `core-28-promotion-error.test.ts` + `core-34-remove-promotion-error.test.ts` ผ่าน 14/14 (รวม AC-121, AC-128, AC-130) |
| AC-134 e2e `core-40-discount-action-race` | pass | ผ่าน 1/1 และผ่านซ้ำ 3 รอบ (`--repeat-each=3`) |
| กฎ 98a: ลบ A ค้างอยู่ ปุ่มใส่ disabled และบังคับ `requestSubmit()` ก็ไม่ยิง action (นับ server action ได้ 1) | pass | qa-01-o1-remove-held-apply-disabled.png |
| กฎ 98b: ทำซ้ำ qa #264 O-1 แล้ว A ไม่กลับมา (cart ได้ `[]` แล้วใส่ B ได้ `[B]`) ครบ 4 ชุด (cart/checkout × 1280/375) | pass | qa-02-o1-after-release-only-b.png |
| ลบ A ล้ม (500) แล้วใส่ B ได้ `[A, B]` และแสดง error ภาษาไทย | pass | qa-03-remove-500-then-apply-a-plus-b.png |
| ใส่โค้ดค้างอยู่ ปุ่มลบ disabled และคลิกแบบ force ก็ไม่ยิง; ใส่ล้ม (500) แล้วปุ่มลบ/ปุ่มใส่กลับมาใช้ได้และลบ A ได้จริง | pass | qa-04-apply-held-remove-disabled.png |
| ไม่มี `_medusa_jwt` ทั้งตอนใส่และตอนลบ ได้ `SIGN_IN_AGAIN_MESSAGE` โค้ดไม่เปลี่ยน และปุ่มไม่ค้าง disabled | pass | qa-05-no-jwt-sign-in-again.png |

## เทียบกับ develop build (`023a720`) — ยืนยันว่า bug เดิมเกิดจริง
- ใช้ spec เดียวกันกับ backend ตัวเดียวกัน (PR นี้แก้เฉพาะ storefront)
- บน develop ปุ่มใส่โค้ดยังกดได้ระหว่างที่การลบค้าง ผลลัพธ์ cart คือ `[A, B]` ทั้ง 4 ชุด (A กลับมาเงียบๆ ตรงกับ qa #264 O-1)
- บน PR ทั้ง 4 ชุดได้ `[]` แล้วตามด้วย `[B]`
- เคส "ลบล้ม (500) แล้วใส่ B ได้ `[A, B]`" ผ่านทั้งบน develop และ PR (พฤติกรรมเดิมคงอยู่)

## Negative / edge (spec ของ qa ชั่วคราว: 8 เคส × 4 ชุด = 32/32 ผ่านบน PR build)
- ลบ A สำเร็จแล้วใส่ B ทันทีที่ได้ response ได้ `[B]`
- ลบสองโค้ดโดยคลิกทั้งสองปุ่มใน tick เดียว ยิง action แค่ 1 ครั้ง จากนั้นลบตัวที่เหลือทันทีได้ `[]` และหลัง reload ก็ยังว่าง
- ลบ A แล้วลบ B ต่อทันทีหลัง response แรก ได้ `[]` ไม่มีโค้ดที่ลบแล้วกลับมา
- กดปุ่มใส่โค้ดสองครั้งเร็วๆ (dblclick) ยิง action 1 ครั้ง ได้ `[A, B]`
- รันซ้ำ 3 รอบ (O1-repro, ลบสองโค้ด, ใส่ค้าง และ AC-134 ของ builder) ผ่าน 39/39

## Regression (prod build)
- unit core-28/34/36/40 ผ่าน 14/14
- e2e ผ่าน 8/8: `core-40-discount-action-race` AC-134, `core-14g` AC-120, `core-19c` AC-100 ×4 และ AC-104, `core-4g` AC-99

## Defect
ไม่พบ

## Observation (ไม่บล็อก)
1. ถ้าบังคับ `requestSubmit()` ระหว่างที่การลบค้าง ปุ่มใส่โค้ดจะขึ้น "กำลังดำเนินการ..." จนการลบเสร็จ (qa-01) ไม่มี action ถูกยิงจริง ผู้ใช้ทั่วไปเจอไม่ได้เพราะปุ่มเป็น disabled และ Enter ส่งฟอร์มไม่ได้เมื่อปุ่ม submit ปิดอยู่
2. เคส "ก่อน refresh" ฝั่ง browser แยกจริงไม่ได้ เพราะ server action ส่ง RSC ที่ revalidate แล้วกลับมาใน response เดียวกัน e2e จึงทดสอบแบบใส่ทันทีหลัง response ส่วนกรณีที่ prop ไม่ refresh มี unit AC-134 ครอบคลุม
3. ไอคอนลบระหว่างกำลังลบแสดงสถานะได้แค่ opacity-50 (qa #264 O-3 — spec ตัดเป็น out of scope แล้ว)

## สรุป
CORE-40 ผ่านกฎข้อ 98 (a)(b) และ AC-134 ทั้งหน้า cart และ checkout ที่ 1280px และ 375px bug O-1 เดิมเกิดจริงบน develop และไม่เกิดบน PR นี้ regression ผ่านครบ ไม่พบ defect
