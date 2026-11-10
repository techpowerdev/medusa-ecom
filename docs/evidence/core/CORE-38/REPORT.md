# QA — CORE-38 (PR #267): สรุปที่อยู่ checkout ที่ < 640px และ label ลอยของ `Input` (spec 01 กฎข้อ 96, AC-132)

**สภาพแวดล้อม**
- build แบบ prod: backend `medusa build` + `medusa start`, storefront `next build` + `next start`
- commit `2603688`, Node 22.23.3, Stripe test mode, DB แยก
- browser: Chromium 156.0.8078.4 (Playwright 1.64.1) — Firefox และ WebKit ไม่ได้ทดสอบ เพราะเครื่องไม่มี browser build ที่ตรงกับ Playwright 1.64.1
- หา element ด้วย `data-testid` และตรวจข้อความไทยด้วย regex `[฀-๿]`
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #267 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-132 (a) cart จัดส่ง อีเมลยาว 101 ตัวไม่มีช่องว่าง @375/639: สามกล่องเรียงแนวตั้ง intersection = 0 ทุกคู่, ข้อความอยู่ในกล่องของตัวเอง, `scrollWidth` = viewport | pass | qa-03-shipping-summary-long-email-375.png |
| AC-132 (a) cart จัดส่ง @640/1280: แถวเดียว top = 168 เท่ากันทั้งสามกล่อง, ไม่ซ้อน, ไม่ล้น | pass | ผลวัด bounding box (640: x = 24/223/421, w = 195) |
| กฎข้อ 96 (a) cart ดิจิทัลล้วน อีเมลยาว 104 ตัว @375/639 แนวตั้ง, @640/1280 แถวเดียว, ไม่ซ้อน, ไม่ล้น, ไม่มีคำว่า "จัดส่ง" | pass | qa-04-digital-only-summary-375.png |
| AC-132 (b) register @1280/375 (เข้าจาก `/th/account?return_to=/th/g/<token>`) กรอกแบบพิมพ์ทีละตัวและแบบ `fill`, Tab, คลิก label, ลบแล้วพิมพ์ใหม่, ส่งแล้วได้ error "อีเมลนี้มีบัญชีแล้ว": หลัง transition จบ `label.bottom ≤ input.top + paddingTop` ทุกช่องที่มีค่า (gap = +2px) | pass | qa-02-register-after-error-settled-375.png |
| AC-132 (b) login @1280/375 ทั้งตอนกรอกและหลังรหัสผ่านผิด, และฟอร์มที่อยู่ checkout (จัดส่ง 9 ช่อง / ดิจิทัล 6 ช่อง) @375/1280: gap = +2px | pass | ผลวัดจาก script |
| ข้อสังเกต qa-04 ของ #258: ทำซ้ำได้ (ภาพกลาง transition) | ดู Observation 1 | qa-01-register-fill-mid-transition-1280.png |
| regression e2e (`core-38-mobile-layout`, `thai-ui-*`, `ev-7c-*`, `core-14*`) | pass 33/33 | รันบน prod build (ดู Observation 3) |

## Negative / edge

| กรณี | ผลที่ได้ |
|------|---------|
| ขอบ 639 กับ 640px | 639 เรียงแนวตั้ง 640 เป็นแถวเดียว ตรงกับ breakpoint `sm` |
| ชื่อ 50 ตัว / ที่อยู่ 63 ตัว / เมือง 46 ตัว เป็นอักษรละตินไม่มีช่องว่าง | **fail** ที่ `2603688`: ดู Defect D-1 |
| ปุ่ม `edit-address-button` @375 | อยู่ในกรอบ section ไม่ล้น |
| ส่ง register ที่ error แล้ว React reset ฟอร์ม | ชื่อ/นามสกุล/อีเมล/เบอร์ยังอยู่ label ลอยถูกต้อง รหัสผ่านถูกล้าง error เป็นภาษาไทย |

## Defect

**D-1 (minor, กฎข้อ 96(a) "อีเมล/ข้อความยาวตัดบรรทัดในคอลัมน์ของตัวเอง")** — **แก้แล้ว** ใน `371d916` (`[overflow-wrap:anywhere]` ที่ container ของแถวสรุปจุดเดียว + e2e จัดส่ง/billing ต่างกัน/digital-only ที่ 375/640/1280 red → green) ผ่าน re-review
- ขั้นตอนทำซ้ำ: login แล้วใส่ t-shirt ลงตะกร้า ไปที่ `/th/checkout?step=address` กรอกชื่อ `Somchaiwithaveryveryverylongfirstnamewithoutspaces` และที่อยู่ `Moo9SukhumvitRoadKhlongToeiNueaWattanaBangkokThailand1234567890` แล้วกด `submit-address-button`
- Expected: ข้อความตัดบรรทัดในกล่อง `shipping-address-summary` และ `scrollWidth ≤ viewport`
- Actual: @375 ข้อความยาวถึง right = 523px และ `scrollWidth` = 523 (หน้าเลื่อนแนวนอนได้); @640/1280 ข้อความล้นไปทับคอลัมน์ "ข้อมูลติดต่อ"
- สาเหตุ: PR ใส่ `[overflow-wrap:anywhere]` เฉพาะ `Text` ของอีเมล ส่วน `Text` ของชื่อ/ที่อยู่/เมืองใน `shipping-address-summary`, `billing-address-summary` และคู่ digital-only ไม่ได้ใส่ (น่าจะมีอยู่เดิมบน develop)
- หลักฐาน: qa-05-long-address-overflow-375.png

## Observation
1. **qa-04 ของ #258 ทำซ้ำได้ แต่เป็นภาพกลาง transition ไม่ใช่ label ทับค่าค้างอยู่**
   - ขั้นตอน: Chromium @1280 หรือ @375 → `/th/account?return_to=/th/g/x` → `register-button` → `fill` ทั้ง 5 ช่องต่อกัน (25–32ms) → `page.screenshot` ทันที → label ทุกช่องยังไม่ลอย ทับค่า (gap −14px) ตรงกับ qa-04
   - ผลวัดตามเวลา: t≈100ms gap −3 ถึง −9, t≈200ms +0.1 ถึง +1.5, t≈320ms +2.0 และ `getAnimations()` = 0 (transition 300ms)
   - การพิมพ์ทีละตัว หรือ `fill` แล้วรอ ≥ 320ms ไม่ทับเลย; autofill จริงของ browser ทดสอบใน Playwright headless ไม่ได้
   - ผู้ใช้จริงไม่เห็นการทับค้าง จึงไม่ถือเป็น defect — ส่วน (b) ของกฎข้อ 96 ไม่ต้องแก้โค้ด (e2e ของ PR รอ animation จบก่อนวัดอยู่แล้ว)
2. label ที่ลอยแล้วห่างจากพื้นที่ข้อความเพียง 2px ผ่านเงื่อนไขก็จริง แต่ระยะเผื่อน้อย
3. รอบแรกมี 2 test ล้มซ้ำ 2 ครั้ง (`thai-ui-checkout` AC-48/AC-75 และ `ev-7c` AC-37) restart storefront แล้วผ่านทั้ง build ของ develop และของ PR ชุดเต็มผ่าน 33/33 — diff ของ PR แตะแค่ className จึงไม่เกี่ยว น่าจะเป็น state/cache ของ storefront process แรกหลัง build

## สรุป
AC-132 ผ่านครบทั้งที่ 375/639/640/1280 สำหรับ cart จัดส่งและ cart ดิจิทัลล้วน label ของ register, login และฟอร์มที่อยู่ checkout ไม่ทับค่าเมื่อ transition จบ ภาพ qa-04 ของ #258 เป็นภาพกลาง animation พบ defect เล็ก D-1 (ชื่อ/ที่อยู่ยาวไม่มีช่องว่างล้นคอลัมน์) ซึ่งอยู่ในกฎข้อ 96(a) — แก้แล้วใน PR นี้ (`371d916`)
