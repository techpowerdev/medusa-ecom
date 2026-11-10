# รายงาน QA — CORE-55 return จากหน้าเว็บได้ location ของ return option (PR #336)

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 113, AC-150..154 · ADR-022
Commit ที่ตรวจ: `da5918fc` · วันที่ 2026-11-10
Stack: backend prod build (`medusa start`) :9660 + storefront `next build`/`next start` :8660, DB แยก, Stripe key ปลอม, ไม่ใช้ Redis

## ผลต่อ AC
| AC | ผล | หลักฐาน |
|---|---|---|
| AC-150 return จากหน้าเว็บได้ `location_id` ของ option, `requested` | PASS | integration `store-returns-receive.spec.ts` ผ่าน; e2e AC-154 ตรวจ `location_id` = location ของ Standard return; QA Q1/Q2/Q4/Q5 ตรวจซ้ำผ่าน UI (desktop และมือถือ 390×844) รูป 01 |
| AC-151 admin receive 3 ขั้น 200, `received`, `received_quantity=1`, stocked +1, reserved ไม่เปลี่ยน, event, ค่าคอม reversed −฿100 | PASS | integration (รวมเคสค่าคอม `reversed`/`returned` −100 จาก 200) ผ่าน; e2e AC-154 และ QA Q1 ตรวจผ่าน UI แอดมินจริง รูป 03, 04, 05 |
| AC-152 client ส่ง `location_id` เองได้ 400 (รวม null), unit ของ chain | PASS | `store-returns-overrides.spec.ts` ผ่านโดยไม่แก้; QA Q6 ส่ง location จริง, `sloc_fake` และ `null` ได้ 400 `invalid_data` ทุกค่า ไม่สร้าง return, ไม่ส่งได้ 200 พร้อม location ของ option (unit ไม่ได้รันในเครื่อง ให้ CI) |
| AC-153 option ไม่มี location ได้ 400; managed ไม่มี level ได้ 400; unmanaged คืนและรับได้ | PASS | integration ผ่าน; QA Q5 ผ่านหน้าเว็บ: สินค้ามี stock เฉพาะ location อื่น หน้า return แสดง `return-error` = "ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" (ภาษาไทย ไม่หลุดข้อความอังกฤษ) ไม่มี return หรือ fulfillment ใหม่ และ backend `warn` มี order/location; สินค้า `manage_inventory=false` คืนแล้วแอดมินรับผ่าน UI ได้ `received` |
| AC-154 e2e ลูกค้าขอคืน แล้วแอดมินกด Receive items ได้ confirm 200, stock +1, ลิงก์หาย | PASS | `core-55-return-receive.spec.ts` ผ่าน 3/3 ครั้ง รูป 01–04 |

## ทำซ้ำบั๊กเดิม (DIAG-RETURN-01)
ทำซ้ำตามขั้นตอนเดิมโดยให้ Playwright คลิกจริงในหน้าเว็บ (headless) นอก e2e ของ PR ทั้งฝั่งลูกค้าและแอดมิน: ลูกค้าเข้า `/th/account/orders/details/<id>` กด `order-return-button` ไปที่ `/return` เลือกจำนวนแล้วกด `return-submit-button` จากนั้นแอดมินเปิด `/app/orders/<id>` คลิกลิงก์ `.../receive` แล้วกด Save
ผล: `POST /admin/returns/:id/receive/confirm` ได้ 200 ทุกเคส ไม่มี toast error (`[data-sonner-toast][data-type="error"]` = 0) ไม่มี response 5xx จาก `/admin/*` และใน log ไม่มี `Cannot receive the Return at location null` → **บั๊กเดิมทำซ้ำไม่ได้แล้ว**

## คำสั่งและ exit code
| คำสั่ง | exit |
|---|---|
| `pnpm install --frozen-lockfile` | 0 |
| `pnpm --filter backend db:migrate` / `seed` | 0 / 0 |
| `pnpm --filter backend build` | 0 |
| `pnpm build` (storefront) | 0 |
| `E2E_SAVE_EVIDENCE=1 npx playwright test e2e/core-55-return-receive.spec.ts e2e/core-20-return-request.spec.ts --project=chromium` → 2 passed | 0 |
| `npx playwright test e2e/core-55-return-receive.spec.ts --repeat-each=2` → 2 passed | 0 |
| `jest --runInBand integration-tests/http/store-returns-receive.spec.ts integration-tests/http/store-returns-overrides.spec.ts` → 12 passed | 0 |
| QA spec 7 เคส → 6 passed, 1 failed (Q3b = D-1) | 1 |

## Edge case
| เคส | ผล |
|---|---|
| Q1 order 2 line (A×2, B×1) คืนบางส่วน (A 1 + B 1) แล้วแอดมินรับผ่าน UI (drawer แสดง 2 แถว รูป 05) | PASS: `received` ได้ [1,1], stock A +1 และ B +1, reserved ไม่เปลี่ยน, ลิงก์หาย |
| Q1 ต่อ: คืนรอบสองเฉพาะ A ที่เหลือ 1 ชิ้น (B หายจากฟอร์ม ตัวเลือก A เหลือ 0–1) | PASS: return ที่ 2 มี location, รับได้, stock A รวม +2 |
| Q2 คืน 2 ชิ้น แอดมินแก้ช่องจำนวนเป็น 1 (รับบางส่วน) | PASS: confirm 200, `partially_received`, `received_quantity=1`, stock +1 |
| Q3a กดยืนยันขอคืนสองครั้งติด (dblclick) | PASS: return 1 รายการ |
| Q3b สองแท็บกดส่งพร้อมกัน (line qty 1) | **FAIL: ดู D-1** |
| Q4 มือถือ 390×844 | PASS: `order-return-success` เป็นภาษาไทย (regex `[฀-๿]`), มี location |
| Q7 ยิง `POST /store/returns` พร้อมกัน 2 ครั้งผ่าน API แล้วรับของทั้งคู่ | ได้ 200, 200 → return 2 รายการ; return ที่ 2 `receive-items` ได้ 400 แต่ `receive/confirm` ได้ 200 แบบไม่มี item; stock รวม +1 (ไม่เกิน), reserved ไม่เปลี่ยน |

## Defect
**D-1 (ระดับกลาง, มีอยู่แล้วใน core — ไม่ใช่ regression ของ CORE-55): ขอคืนพร้อมกันจากสองแท็บได้ return 2 รายการสำหรับ line ที่มีแค่ 1 ชิ้น**
- ขั้นตอนทำซ้ำ: order ที่ fulfill และ ship แล้ว มี 1 line จำนวน 1 → ลูกค้าคนเดียวเปิด `/th/account/orders/details/<id>/return` สองแท็บ → ทั้งสองแท็บเลือกจำนวน 1 → กด `return-submit-button` ทั้งสองแท็บพร้อมกัน
- Expected: สำเร็จแท็บเดียว อีกแท็บเห็น `return-error` ภาษาไทย และมี return 1 รายการ
- Actual: ทั้งสองแท็บเห็น `order-return-success` และ `GET /admin/returns?order_id=` ได้ return `requested` 2 รายการ แต่ละรายการ quantity 1 และมี location (ทำซ้ำได้ 2/2 รอบ ผ่าน API ใน Q7 ก็เกิด)
- ผลกระทบ: แอดมินเห็น return ค้าง 1 รายการที่รับไม่ได้ (receive-items ได้ 400 ซึ่งใน UI น่าจะขึ้น toast error) แต่ stock ไม่เพิ่มเกิน (core ตรวจตอนรับของ)
- สาเหตุ: `createAndCompleteReturnOrderWorkflow` ของ core-flows 2.22.1 ไม่มี `acquireLockStep` (grep `create-complete-return.js` ไม่พบ) และ middleware ของ PR ไม่ได้ทำให้เรื่องนี้เกิดขึ้นใหม่ ยังไม่ได้รันยืนยันบน develop
- ข้อเสนอ: แยก follow-up task (lock ต่อ order ใน middleware/workflow หรือ idempotency) ไม่บล็อก PR นี้

## หลักฐาน (≤ 5 รูป, ทุกรูป < 300KB)
1. `01-store-return-success.png` — ลูกค้าเห็นข้อความขอคืนสำเร็จ
2. `02-admin-order-receive-link.png` — หน้า order มีลิงก์ Receive items
3. `03-admin-receive-form.png` — drawer รับของ จำนวน 1
4. `04-admin-order-received.png` — "1x items return received", toast Success, ลิงก์หาย
5. `qa336-05-admin-receive-two-lines.png` — drawer รับของ order 2 line (QA Q1) ที่ "Bangkok Warehouse"

## ที่ยังไม่ได้ทดสอบ
- ค่าคอม affiliate reversed ทดสอบผ่าน integration เท่านั้น ไม่ได้ทดสอบผ่าน UI ด้วยลิงก์ affiliate จริง
- รับของแบบ damaged (`dismissed_quantity`) และกรณีหลัง `partially_received` ว่ารับของที่เหลือต่อได้หรือไม่
- unit test ของ backend, integration ชุดเต็ม, e2e ชุดเต็ม และ lint/typecheck (ให้ CI)
- D-1 ยังไม่ได้รันยืนยันบน develop
- ไม่ได้มีคนกดเองด้วยมือ (manual) — ทุกการกดผ่าน UI เป็น Playwright headless
- ไม่ได้ทดสอบ Stripe จริง (order ใช้ `pp_system_default`)
