# QA REPORT — GB-6d (PR #143) admin group-buy: refetch เมื่อ succeed/fail ล้ม, highlight, ปุ่มปิด, selection ข้ามหน้า

- Spec: `docs/spec/04-group-buying.md` กฎข้อ 23, AC-41 (อ่านจาก `origin/develop`)
- Commit ที่ตรวจ: `fcd0b5f` (branch `feat/GB-6d-admin-group-polish`)
- สภาพแวดล้อม: prod build (`medusa build` + `medusa start` จาก `.medusa/server`, admin ที่ `/app`), `NODE_ENV=production`,
  DB แยก (migrate + seed), Redis db แยก, Stripe key ปลอม (ไม่มีการเรียก Stripe), Playwright chromium, worktree แยก
- CI run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40487884270 (report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` 14 วัน)
- QA spec (ในเครื่อง ไม่ได้ commit) 6 test + `apps/storefront/e2e/group-buy-admin-members.spec.ts` (4 test)
  + regression `group-buy-admin-detail.spec.ts` (4 test) → **14 passed**

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-41 (1) กลุ่มที่แสดงเป็น `open` แต่ตั้งเป็น `succeeded` ทาง API แล้ว → กด `gb-group-fail` + ยืนยัน → 400 `not_allowed` → toast error, มี `GET .../groups` ใหม่, แถวเป็น `succeeded` ใน 348ms (< 5 วินาที), ปุ่ม succeed/fail หาย, ไม่ reload, POST 1 ครั้ง | pass | `03-qa-ac41-fail-4xx-refetch.png`, `01-fail-rejected-refetched.png` |
| AC-41 (2) เลือกแถว → highlight แถวเดียว (เลือกแถวอื่นแล้ว highlight ย้าย); กด `gb-memberships-close` → `gb-memberships-table` หาย highlight หาย | pass (มี D-1) | `04-qa-ac41-selected-highlight.png`, `02-selected-row-highlight.png` |
| AC-41 (3) 23 กลุ่ม (> 20): เลือกแถวหน้า 1 → Next → ไม่มี `gb-memberships-table` → Prev → ไม่เปิดค้าง; หน้า 2 เลือกแถวได้ปกติ | pass | `05-qa-ac41-next-page-closed.png` |
| AC-41 (4) type `Membership` ใน `src/admin/` ไม่มี `order.total` | pass | unit `group-buy-membership.unit.spec.ts` 8/8 |

## Negative / edge case

| กรณี | Result | หมายเหตุ |
|------|--------|----------|
| dblclick `gb-group-fail` + dblclick ปุ่มยืนยัน | pass | กล่องยืนยันเดียว, POST 1 ครั้ง, กลุ่มใน DB เป็น `failed` |
| POST succeed กับ fail พร้อมกันทาง API | pass | succeed 200, fail 400 `not_allowed` — สำเร็จได้ตัวเดียว |
| route ตอบ 500 (mock `page.route`) | pass | toast error, มี GET กลุ่มใหม่ (`onSettled`), แถวยัง `open`, กดซ้ำแล้วสำเร็จ |
| regression GB-6c2 (AC-35) + GB-6b (AC-30/31) | pass | AC-35 ×2, detail spec ×4 |

## Defect

- **D-1 (minor, ด้านภาพ ไม่ block — บันทึกเป็น follow-up)**: highlight ของแถวที่เลือกไม่ครอบคอลัมน์แรก (Kind)
  - ทำซ้ำ: เปิด `/app/group-buying/<id>` ที่มี ≥ 2 กลุ่ม → คลิกแถว → เลื่อนเมาส์ออกจากตาราง
  - Expected: ทั้งแถวมีพื้น `bg-ui-bg-highlight`
  - Actual: `tr` = `rgb(239, 246, 255)` แต่ `td` แรกเป็น sticky column ของ `DataTable` ที่มี `bg-ui-bg-base` จึงยังเป็นสีขาว (`04-qa-ac41-selected-highlight.png`) — test ของ builder เทียบแค่สีของ `tr`
  - ข้อเสนอ: ใส่สีที่ `td` ด้วย และให้ test เช็กสีของ `td` แรก

## สรุป
AC-41 ผ่านครบ, edge case ผ่านทั้งหมด, defect ด้านภาพ 1 ข้อ (D-1) ไม่ขัดกับเนื้อความของ AC
