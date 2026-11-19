# QA — ADM-23 (PR #373): partners ไม่กระพริบตอน clamp offset + PartnerActions remount เมนู

- Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 27, AC-28 (+ regression AC-8, AC-20, AC-23, AC-25)
- Commit ที่ตรวจ: `f10f7b24` (head ของ `feat/ADM-23-partners-clamp-actions` คือ `5858edbc` + merge `origin/develop` `ff502ff1`)
- Baseline สำหรับเทียบ: `origin/develop` @ `4b9e488e` (build แยก ใช้ DB เดียวกัน)
- วันที่ตรวจ: 2026-11-14
- หลังจากนี้ builder แก้ D-1 (การลบใน `finally` ของ test ตรวจ `.ok()`) — เปลี่ยนเฉพาะ test ยืนยันด้วย CI ของ head ล่าสุด

## สภาพแวดล้อม
- prod build: `medusa build` แล้ว `medusa start` จาก `.medusa/server` (`NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) ที่ port 9313
- DB `medusa_qa373` (สร้างใหม่ → `db:migrate` → `seed` ซึ่งสร้าง admin user), Redis db 13
- Stripe ใช้ test key เท่านั้น
- Node v22.23.3, Playwright chromium, viewport 1280×800, `ADMIN_UI_OPTIONS` (en-US, Asia/Bangkok, `x-forwarded-proto: https`)
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #373 (14 วัน)

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-28 (e2e) — `?partners_offset=99999999` + หน่วง GET 800ms: ไม่มี "No partners on this page" ตลอด 2 วินาที, clamp ไปหน้าสุดท้าย | pass | e2e ของ builder `evoucher-admin-forms.spec.ts:207` ผ่าน 4/4 (1 รอบ + `--repeat-each=3`); QA-1 (partner 23 ราย หน้าสุดท้ายไม่ใช่หน้าแรก) จบที่ `partners_offset=20` 3 แถว ไม่มี empty — `01-partners-offset-clamped-no-empty-flash.png`, `qa373-01-clamp-offset20-3rows.png` |
| AC-28 (e2e) — Edit → Escape → body ไม่มี `pointer-events: none`, Create partner เปิด modal ได้ | pass | e2e ของ builder ผ่าน; QA-2 ทำ Edit→Escape 3 รอบ (แถว 0,1,0) + Edit→Cancel + Delete→Cancel ทุกครั้ง body = `auto` และ modal เปิดได้ — `02-partner-edit-escape-create-opens.png` |
| AC-28 — "ล้มบน develop" | ยืนยันแล้ว | build develop: test AC-28 ล้มที่ `emptySeen` (เห็น "No partners on this page" 4 ครั้ง) และ probe Edit→Escape ทำให้ body ค้าง `none` จนคลิกครั้งถัดไป timeout |
| AC-28 (unit) — `isPastLastPage` (5/0→true, 0/0, 5/2, undefined → false) | pass | `page-offset.unit.spec.ts` PASS |
| AC-28 (static) — import helper ใน codes/partners, ไม่มี "No partners on this page", `key={menuKey}`, Edit `disabled: removing` | pass | `medusa-ui.unit.spec.ts` PASS (2 suites, 221 tests) |
| AC-8 (regression) | pass | `evoucher-admin-partners.spec.ts` 3/3 (แบ่งหน้า 20/5, offset abc, empty, Create, Edit/Delete) |
| AC-20 (regression) — codes `?codes_offset=99999999` ไม่มี empty กระพริบ | pass | `evoucher-admin-pool-page.spec.ts:245` ผ่าน (รวม AC-7, AC-14) |
| AC-23 (regression) — mock 0 แถว + `partners_offset=abc`/`-50` | pass | QA-6: URL ไม่มี param, `evoucher-partners-empty` แสดง, ปุ่ม Create partner 1 ตัว, ไม่มี NaN, modal เปิดได้ (เพิ่ม `12.5`) |
| AC-25 (regression) — pools/partners/codes ตอบ 500 / abort / 401 / ว่าง | pass | `evoucher-admin-forms.spec.ts` 7 test + `evoucher-admin-pool-page.spec.ts` 5 test ผ่าน |

รวม e2e ที่มีอยู่ 21/21 ผ่าน (`evoucher-admin-forms`, `evoucher-admin-partners`, `evoucher-admin-pool-page`) และ spec ของ qa 7/7 ผ่าน

## Edge / negative (spec ของ qa ไม่ commit)
| กรณี | ผล |
|------|----|
| QA-1: partner 23 ราย `?partners_offset=99999999` / `40` / `23` / `25` / `21` | ทุกค่า clamp ไป `20` แสดง 3 แถว; MutationObserver ไม่เห็น "No partners on this page", "No partners yet" และ `evoucher-partners-empty` |
| QA-3: ลบ partner (หน่วง DELETE 3 วินาที) + dblclick ปุ่มยืนยันใน prompt | DELETE 1 ครั้ง; ระหว่างลบ Edit และ Delete disabled ทั้งแถวที่ลบและแถวอื่น; force-click Delete ที่ disabled ไม่เปิด prompt; ลบจบแล้วเมนูกลับ enabled — `qa373-02-deleting-edit-delete-disabled.png` |
| QA-4: 21 ราย อยู่ที่ `partners_offset=20` (1 แถว) แล้วลบแถวนั้น (หน่วง GET 800ms) | URL ลบ `partners_offset` กลับหน้าแรก 20 แถว ไม่มี empty กระพริบ — `qa373-03-delete-last-row-back-to-page1.png` |
| QA-5: partner ไม่ถึงหนึ่งหน้า (mock 3) กับ `?partners_offset=40` / `99999999` / `20` | param ถูกลบ, 3 แถว, ไม่มี empty; mock 0 + `99999999` → param ถูกลบ เห็น `evoucher-partners-empty` |
| QA-7: ข้อมูลจริง 20 ราย กับ `abc` / `-50` / `1e1` / `99999999` | หน้าแรก 20 แถว ไม่มี param ไม่มี NaN ไม่มี empty |

## Defect
**D-1 (blocker ของ merge, test ไม่ใช่โค้ดแอป)** — CI แดง: test ใหม่ขัดกฎ hygiene AC-99
- run https://github.com/techpowerdev/medusa-ecom/actions/runs/43471267909 (`f10f7b24`): `lint-typecheck` fail, `backend-tests` fail (job รวมผล), `storefront-e2e` skipping
- ทำซ้ำ: `pnpm --filter storefront test:e2e:unit`
- Expected: `AC-99: request.delete ใน finally ตรวจ .ok() ทุกครั้ง` ผ่าน
- Actual: `finally { await request.delete(...PARTNERS_PATH/${partner.id}...) }` ไม่ตรวจ `.ok()` (describe ADM-23)
- สถานะ: ส่งกลับ builder แก้ — ยืนยันด้วย CI ของ head ล่าสุด

ไม่พบ defect ในโค้ดแอปพลิเคชันของ ADM-23

## ข้อสังเกต
- **O-1 (มีอยู่ก่อน ไม่ใช่ regression):** เปิดเมนูต่อแถวแล้วปิด จากนั้นเปิดเมนูของอีกแถว Escape ครั้งแรกไม่ปิดเมนู (body ยัง `pointer-events: none`) ต้องกดครั้งที่สอง — มี `[data-radix-popper-content-wrapper]` ค้าง 1 ตัวหลังปิดเมนูแรก; เหมือนกันบน develop `4b9e488e` ทั้ง partners และ Programs (`ProgramActions`); หน้า `/app/products` ของ Medusa ไม่เป็น → follow-up
- **O-2:** e2e ของ builder ทดสอบกรณีหน้าสุดท้าย = หน้าแรก (ลบ param) เพราะ DB ใน CI มี partner น้อย; QA-1 ครอบกรณีหน้าสุดท้ายไม่ใช่หน้าแรกแล้ว
