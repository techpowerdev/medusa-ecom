# QA: GB-13 สร้างแคมเปญแบบ idempotent (PR #259)

spec: `docs/spec/04-group-buying.md` กฎข้อ 33, AC-52 (regression AC-49, AC-50)
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`) ที่ commit `9535580` admin ที่ `/app/group-buying`, Redis locking, browser ตั้ง locale en-US และ timezone Asia/Bangkok
report และ trace ฉบับเต็มอยู่ใน CI artifact ของ run ใน PR #259 (เก็บ 14 วัน)
หมายเหตุ: หลัง QA มีแก้ตาม review 1 จุด (`954811a`: `useRef("")` แทน `useRef(crypto.randomUUID())` + ไม่ส่ง key เมื่อว่าง) ผ่าน re-review และ e2e `group-buy-admin-form.spec.ts` 4/4 บน head `da65c1b`

| AC | Result | Evidence |
|----|--------|----------|
| AC-52 (API) ยิง key เดียวกันพร้อมกัน 2, 3 และ 5 request | pass | ทุก request ได้ 200 และได้ `campaign.id` เดียวกัน; GB campaign, Medusa campaign, promotion `GBT-*` และ link เพิ่มอย่างละ 1; `campaign_identifier = group-buy-<K>` (ผลจากสคริปต์ API ของ qa) |
| AC-52 (API) ส่ง key เดิมซ้ำทีหลังโดย body ต่าง (name และ value ต่าง) | pass | ได้ 200 id เดิม name เดิม ไม่มีของใหม่ response รูปเดียวกัน และ deep-equal กับครั้งแรก |
| AC-52 (API) ไม่ส่ง key | pass | ส่งทีละครั้งสองครั้งได้ 2 แคมเปญ ส่งพร้อมกัน 3 ครั้งได้ 3 แคมเปญ (พฤติกรรมเดิม) |
| AC-52 (API) key ผิดรูป | pass | `"a b"`, ยาว 129 ตัว, ยาว 7 ตัว, อักษรไทย, ตัวเลข, `""`, `null`, `abc.def/ghi` ได้ 400 `invalid_data` ทุกตัวและไม่มีของใหม่; key ยาว 8 และ 128 ตัวได้ 200 |
| AC-52 (API) ไม่ login admin หรือ token ผิด | pass | 401 ไม่มีของใหม่ |
| AC-52 (UI) ดับเบิลคลิก submit | pass | qa-01-dblclick-one-campaign.png: POST 1 ครั้ง, key รูป UUID v4, DB มี 1 แคมเปญ |
| AC-52 (UI) response หายหลัง request ถึง backend แล้ว (`route.fetch` แล้ว `abort`) | pass | qa-02-network-error-form-open.png: ฟอร์มยังเปิด ปุ่มกดได้ และ backend สร้างไปแล้ว 1 |
| AC-52 (UI) submit ซ้ำ (ดับเบิลคลิก) หลัง network ล้ม | pass | qa-03-retry-same-campaign.png: ส่ง key เดิม ได้ 200 ตารางมี 1 แถว DB มี 1 แคมเปญ |
| AC-52 (UI) ปิดฟอร์มด้วย Esc แล้วเปิดใหม่สร้างอีกอัน | pass | qa-04-reopen-new-campaign.png: key ใหม่ ได้แคมเปญใหม่ และแคมเปญแรกยังมีแถวเดียว |
| AC-49 (regression, API) | pass | 1 สินค้าได้ 200; 2 สินค้า, `values: []` หรือไม่มี rule ได้ 400 `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED`; รวมทั้งชุดเพิ่มแค่ 1 |
| AC-50 และ AC-32 (regression e2e) | pass | `group-buy-admin-form.spec.ts` 4/4 (รวมเคส AC-52 ของ builder) และ `group-buy-admin-dates.spec.ts` 1/1 |

## Negative / edge
- **abort ทันทีขณะ backend ยังประมวลผล แล้วกด retry ทันที:** request ที่สองต้องรอ lock แล้วได้ 200 id เดียวกัน DB มี 1 แคมเปญ (pass)
- **key เดียวกัน ครั้งแรก body ผิด (2 สินค้า) ครั้งที่สอง body ถูก:** ครั้งแรก 400 ครั้งที่สอง 200 สร้างใหม่ 1 ชุด key ไม่ถูกใช้หมดไปเพราะ request ที่ fail (pass)
- **lock ปล่อยครบ:** หลังทดสอบไม่มี key `group-buy-campaign-create:*` ค้างใน Redis และ log ของ backend ไม่มี error

## Defect
ไม่พบ

## Observation
- **O-1 (ใช้ key เดิมหลังลบแคมเปญ):** หลัง `DELETE /admin/group-buy/campaigns/:id` แล้วส่ง key เดิม ระบบสร้างแคมเปญใหม่ (เพราะ Medusa campaign ถูก soft delete) สอดคล้องกับกฎข้อ 33b ที่ค้นจาก campaign ที่ยังอยู่ ไม่กระทบฟอร์ม เพราะฟอร์มสร้าง key ใหม่ทุกครั้งที่เปิด
- **O-2 (Medusa campaign ที่ชื่อชนแต่ไม่มี link):** ถ้ามีคนสร้าง Medusa campaign ด้วย `campaign_identifier = group-buy-<K>` เอง (เช่นผ่าน `/admin/campaigns`) แล้วส่ง K มา จะได้ 400 `invalid_data` "already exists" ไม่ใช่ 500 และไม่มีของค้าง ยอมรับได้
- **O-3 (toast บังปุ่มสร้าง):** toast ของ Medusa (sonner) อยู่มุมขวาบนทับปุ่ม `gb-campaign-create` และหยุดนับเวลาเมื่อเมาส์ชี้อยู่ ใน e2e ถ้าเมาส์ค้างที่ตำแหน่งปุ่มหลังมี toast "Failed to fetch" การคลิกจะถูกบังจน timeout เคส AC-52 ของ builder ผ่านอยู่ แต่มีโอกาส flaky ถ้าลำดับการคลิกเปลี่ยน ไม่ใช่ defect ของ feature
- **O-4 (`crypto.randomUUID()` ต้องใช้ secure context):** ใช้ได้เฉพาะ https หรือ localhost — หลัง `954811a` หน้า list ไม่พังแล้ว แต่การเปิดฟอร์มผ่าน http ด้วย IP ของ LAN ยัง throw ได้ prod ใช้ https ตาม spec 07 จึงไม่กระทบ

## สรุป
กฎข้อ 33 a–d และ AC-52 ผ่านทั้ง API และ UI admin บน prod build โดย AC-49 และ AC-50 ไม่ถอย ไม่พบ defect
