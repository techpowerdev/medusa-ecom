# QA: GB-15 สร้าง idempotency key ด้วย crypto.getRandomValues (PR #285)

spec: `docs/spec/04-group-buying.md` กฎข้อ 33d, AC-58 (regression AC-52, AC-50, AC-32)
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`) ของ commit `0be97c8` เทียบกับ develop `15b2724` ใช้ DB แยก, Stripe test key; admin เปิดที่ `/app/group-buying` ด้วย locale en-US และ timezone Asia/Bangkok
report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #285 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| กฎ 33d (qa): เปิดผ่าน http ที่ไม่ใช่ localhost (IP ในวง LAN) แล้วสร้างแคมเปญ | pass | qa-01-lan-insecure-create-ok.png: `isSecureContext=false`, ไม่มี `randomUUID`, POST ได้ 200, key รูป UUID v4, ไม่มี pageerror, DB มี 1 แคมเปญ |
| เทียบกับ develop build บน origin เดียวกัน | เดิมพัง (ยืนยันแล้ว) | qa-02-develop-lan-form-error.png: ฟอร์มไม่เปิด, pageerror `crypto.randomUUID is not a function`, ไม่มี POST |
| AC-58 unit (`group-buy-form.unit.spec.ts`) | pass | 31/31 รวมเคส 1,000 key ที่มีแค่ `getRandomValues` |
| AC-58 grep และขอบเขต diff | pass | `randomUUID` เป็น 0 ทั้งใน `create-campaign.tsx` และ `group-buy-form.ts`; `openModal` เรียก `newIdempotencyKey()`; diff ไม่แตะ `src/api/` และ `package.json` |
| AC-52 (UI) ดับเบิลคลิก submit | pass | qa-03-lan-dblclick-one-campaign.png: POST 1 ครั้ง ได้แคมเปญเดียว (ผ่านทั้ง LAN และ localhost) |
| AC-52 (UI) network ล้มหลัง request ถึง backend แล้วส่งซ้ำ | pass | qa-04-lan-retry-same-key.png: ใช้ key เดิม ได้ 200 ได้แคมเปญเดียว (ผ่านทั้ง LAN และ localhost) |
| AC-52 (UI) ปิดฟอร์มด้วย Esc แล้วเปิดใหม่ | pass | ได้ key ใหม่ (UUID v4) และแคมเปญใหม่ (LAN และ localhost) |
| AC-52, AC-50, AC-32 regression e2e | pass | `group-buy-admin-form.spec.ts` 4/4 และ `group-buy-admin-dates.spec.ts` 1/1 บน localhost |

## Negative / edge
- เปิดฟอร์มแล้วปิดด้วย Esc โดยไม่ submit แล้วเปิดใหม่: ไม่มี POST ค้าง และ key รอบใหม่ไม่ซ้ำกับรอบก่อน (pass)
- key ทุกตัวที่ browser ส่ง (9 ตัวใน 3 รอบ) ตรงรูป UUID v4 และผ่าน validator ของกฎ 33a (ได้ 200 ทั้งหมด)
- บน localhost (`isSecureContext=true`) ฟอร์มก็ใช้ helper ตัวใหม่เช่นกัน ไม่มี regression

## Defect
ไม่พบ

## Observation
- **O-1 (login admin บน http ใน prod):** `medusa start` ตั้ง session cookie ของ admin เป็น Secure ทำให้ Chrome ทิ้ง cookie บน origin http ที่ไม่ใช่ localhost และ login ผ่าน UI ไม่ติด qa จึงขอ session ผ่าน `POST /auth/session` แล้วใส่ cookie แบบ non-secure เข้า browser ซึ่งไม่กระทบ context (`isSecureContext` ขึ้นกับ origin ของหน้า) — กรณีใช้ http จริงน่าจะเป็น dev server (`medusa develop`) ที่เปิดผ่าน LAN มากกว่า prod หลัง proxy http ไม่ใช่ defect ของ PR นี้
- **O-2:** spec สำหรับ QA เขียนไว้ใน worktree เท่านั้น ไม่ได้ commit

## สรุป
กฎข้อ 33d และ AC-58 ผ่าน admin ที่เปิดผ่าน http ซึ่งไม่ใช่ localhost สร้างแคมเปญได้แล้ว (ใน develop ฟอร์มยังเปิดไม่ได้) ดับเบิลคลิก, ส่งซ้ำหลัง network ล้ม และเปิดฟอร์มใหม่ทำงานถูกต้อง และ AC-52, AC-50, AC-32 ไม่ถอย ไม่พบ defect
