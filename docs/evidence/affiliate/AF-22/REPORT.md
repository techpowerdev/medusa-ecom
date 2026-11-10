# QA AF-22 — ฟอร์มสมัคร/เข้าสู่ระบบ portal affiliate คงค่าหลัง error และกันกดซ้ำ (PR #340)

Spec: `docs/spec/05-affiliate.md` กฎ 46, AC-54 · commit `f3fdbb68`
สภาพแวดล้อม: backend/storefront แบบ prod build (`medusa start` / `next start`), DB แยก, ไม่ใช้ Redis, Stripe key ปลอม
หา element ด้วย `data-testid`; ตรวจข้อความไทยด้วย regex อักษรไทย `/[฀-๿]/` (`THAI`, `expectThai`)

## ผลตาม acceptance criteria

| # | AC-54 / checklist | 1280×800 | 375×812 | หลักฐาน |
|---|---|---|---|---|
| 1 | สมัครด้วยรหัส `admin` → `affiliate-register-error` ภาษาไทย และ name, code, email, password `toHaveValue` ค่าเดิม (กดซ้ำแล้ว error รอบสอง ก็ยังคงค่า) | PASS | PASS | `01-register-admin-kept-desktop.png` |
| 2 | แก้เฉพาะ `affiliate-register-code` แล้วสมัคร → URL `/th/affiliate`, `affiliate-code` ตรงกับที่กรอก และใน DB มี affiliate 1 แถวต่ออีเมล | PASS | PASS | `02-register-fixed-code-portal-mobile.png` |
| 3 | เข้าสู่ระบบด้วยรหัสผ่านผิด → `affiliate-login-error` ภาษาไทย และอีเมล/รหัสผ่านยังอยู่ | PASS | PASS | `03-login-wrong-kept-mobile.png` |
| 4 | หน่วง POST ของ server action 1.5 วินาที → `affiliate-register-submit`/`affiliate-login-submit` เป็น `toBeDisabled()` และ `toHaveText(/^กำลังดำเนินการ\.\.\.$/)`; double-click ส่ง POST 1 ครั้ง; สมัครแล้วได้ affiliate 1 แถว; กด Enter สองครั้งระหว่างส่ง → POST 1 ครั้ง; ได้ผลแล้วปุ่มกลับมา enabled | PASS | PASS | `04-register-pending-mobile.png` |
| 5 | เข้าสู่ระบบสำเร็จ (แก้เฉพาะรหัสผ่านหลัง error) → redirect เข้า portal; `pattern` ปฏิเสธ `AB`, `a`, `-abc`, `abc-`, `ab_cd`, 33 ตัว และรับ `abc`, 32 ตัว (ขอบค่า); `required` (ชื่อว่าง) และ `type=email` ยังกันการส่ง (ไม่มี POST) | PASS | PASS | log e2e |
| 6 | regression `SubmitButton` ที่ใช้ `useFormStatus`: login ลูกค้า (`sign-in-button` disabled + "กำลังดำเนินการ..." ตอนหน่วง, double-click POST 1 ครั้ง, เข้าสู่ระบบได้), checkout address, discount และ checkout first step | PASS | (desktop) | log e2e |

## Edge case เพิ่มเติม
| กรณี | ผล | หลักฐาน |
|---|---|---|
| สองแท็บ (คนละ context) สมัครรหัสเดียวกันพร้อมกัน → แท็บหนึ่งเข้า portal อีกแท็บได้ error ภาษาไทยและทุกช่องยังคงค่า; ใน DB รหัสนั้นมีเจ้าของ 1 แถว | PASS | `05-two-tabs-loser-kept-desktop.png` |
| ส่ง error ซ้ำสองรอบติดกัน → ค่ายังอยู่ ปุ่มกลับมา enabled | PASS | log e2e |
| คลิกแบบ force บนปุ่มที่ disabled ระหว่างส่ง → ไม่ยิง POST ซ้ำ | PASS | log e2e |

## การทดสอบกับ develop (control) — ทำซ้ำบั๊กเดิม
ใช้ `auth-forms/index.tsx` และ `submit-button/index.tsx` ของ `origin/develop` แล้ว build storefront ใหม่ จากนั้นรัน QA spec เดิม:
ล้ม 7 ผ่าน 5 (exit=1)
- เคสคงค่าทุกเคสล้ม (สมัคร, login, Enter, สองแท็บ) เพราะช่องเป็น `""`
- เคสที่ผ่านบน develop ด้วยคือ QA-4 กันกดซ้ำตอนสมัคร, QA-5 validation และ QA-7 login ลูกค้า ซึ่งเป็นพฤติกรรมเดิมที่ต้องคงไว้

## ผลการรัน (คำสั่ง → exit code)
- PR e2e: `playwright test e2e/affiliate-portal.spec.ts --project=chromium` → exit=0, ผ่าน 9/9 (AF-22 4/4, AF-21 1/1, AF-8a 4/4)
- QA spec: `playwright test e2e/qa340-af22.spec.ts --project=chromium` → exit=0, ผ่าน 12/12
- รันซ้ำบน build สุดท้าย: `playwright test e2e/qa340-af22.spec.ts e2e/affiliate-portal.spec.ts` → exit=0, ผ่าน 21/21
- regression: `playwright test core-4j-checkout-discount-address core-40-discount-action-race core-4f-auth-errors core-14-buy-login core-41-checkout-first-step` → exit=0, ผ่าน 14/14
- static: `vitest run src/af-22-portal-forms.test.ts` → exit=0, ผ่าน 3/3
- control (develop): QA spec → exit=1, ล้ม 7 / ผ่าน 5 (ตามคาด)
- mutation (ลบ `isLoading={loginPending}`/`{registerPending}`): QA-4/4b → exit=0, ผ่าน 4/4 (ดูข้อสังเกต)

## Defect
ไม่พบ

## ข้อสังเกต
- ยืนยันสิ่งที่ builder บอกไว้: ถ้าลบ prop `isLoading` ออก ปุ่มก็ยัง disabled และขึ้น "กำลังดำเนินการ..." ระหว่างส่ง เพราะ React 19.0.5 ทำให้ `useFormStatus` เห็น pending ของ submit ที่ใช้ `startTransition` ด้วย ดังนั้น test กันกดซ้ำ (ทั้งของ builder และ QA) จับไม่ได้ถ้า prop นี้หายไป ตอนนี้พฤติกรรมถูกต้อง prop นี้เป็นแหล่งค่า pending ที่ระบุชัดตามกฎ 46(b) เสนอให้ planner ปรับถ้อยคำในกฎ 46(b) และคอมเมนต์ใน `submit-without-reset.ts`
- ในรูป `04` ข้อความบนปุ่มมีแถบไฮไลต์ เพราะ double-click ไปเลือกข้อความไว้ เป็นผลจากการทดสอบเอง ไม่ใช่บั๊กของ UI

## สิ่งที่ไม่ได้ทดสอบ
- WebKit/Firefox และอุปกรณ์มือถือจริง (ทดสอบเฉพาะ Chromium ที่ viewport 375×812)
- regression ของ checkout ที่ 375×812 และ `add-variant-error` ของ account (ไม่มี e2e เฉพาะ); ฟอร์ม register ลูกค้าไม่ได้ใช้ `SubmitButton` แบบเดิมที่ถูกแก้
- เครือข่ายล้มหรือ timeout จริง (ทดสอบเฉพาะการหน่วง ไม่ได้ทำให้ request fail)
- การกดปุ่ม Back ของ browser หลังได้ error
