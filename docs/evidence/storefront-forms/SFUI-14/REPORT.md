# Evidence: SFUI-14 — กฎ autofill/keyframe ของ starter ทับ shadcn (spec 09 กฎ 38, 38b)

qa ตรวจ `5dbb85c0` บน prod build ทั้งสองฝั่ง (backend `NODE_ENV=production` จาก `.medusa/server`, storefront `next build`) Chromium เต็ม (`channel: "chromium"`)
e2e ของ task 3/3 ผ่าน, unit `src/styles` 21/21 ผ่าน, spec ที่อ้างหน้า login/register/เมนูข้าง 21 ไฟล์ ผ่าน 45 / ล้ม 1 (`core-50-nav-narrow:171` 1280 กว้างต่าง 1.27px บน macOS — ทราบอยู่แล้ว ไม่เกี่ยวกับ task นี้), CI storefront-e2e 572 ผ่าน
report/trace เต็มของ Playwright อยู่ใน CI artifact

| AC | Result | Evidence |
|----|--------|----------|
| AC-38 (1) | pass | `sfui-14-autofill-border.spec.ts` AC-38 (1); login-autofill-before.png (ก่อนแก้: กล่องดำซ้อนในช่องรหัสผ่าน + ขอบดำช่องอีเมล), login-autofill-simulated.png (หลังแก้) |
| AC-38 (2) | pass | `sfui-14-autofill-border.spec.ts` AC-38 (2) (CDP `Autofill.trigger` จริง); register-autofill-before.png, register-autofill-focus.png |
| AC-39 (1) | pass | `src/styles/keyframes.test.ts` |
| AC-39 (2) | pass | `sfui-14-menu-animation.spec.ts`; menu-open-mid.png (เฟรมกลาง animation: เลื่อนเข้าจากซ้าย ขนาดเท่าเดิม) |

## ตรวจด้วยตา / edge (นอก AC)
- autofill จริงของ Chrome (CDP) ที่ช่องอีเมลของ login ทั้ง 1280 และ 390: ขอบ 1px สีเทาของ shadcn, พื้นโปร่ง (ไม่เป็นสีฟ้า), ring 3px ตอน focus; ช่องรหัสผ่าน (จำลอง cascade) ไม่มีขอบ/เงาซ้อน ring 3px อยู่ที่ `InputGroup`
- เมนูข้าง 1280×800 และ 390×844: เปิด `enter` tx −390→0, ปิด `exit` tx 0→−389 ทุกเฟรม `matrix(1,0,0,1,tx,0)` ไม่ scale; กด Escape ระหว่างเปิด → เปลี่ยนเป็น `exit` ทันทีไม่มีเฟรม scale; dblclick ไม่มีเฟรม scale; `prefers-reduced-motion` จบที่ `transform: none`
- Dialog เพิ่มที่อยู่ / Popover ตะกร้า / Select ประเทศในเมนูข้าง: ซูม 0.95↔1 + fade ตาม default ของ shadcn (ไม่ใช่ 0.9 ของ starter); CSS ที่โหลดมี `@keyframes enter`/`exit` ของ tw-animate-css เท่านั้น
- ข้อสังเกต: ยังไม่ยืนยันบน Safari (ตาม spec กฎ 38); ภาพมีเฉพาะอีเมลทดสอบ `@example.com`

## Defect
ไม่พบ
