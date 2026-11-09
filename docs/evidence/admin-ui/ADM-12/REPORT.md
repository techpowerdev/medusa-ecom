# QA — ADM-12 (PR #313) ช่อง number ที่ไม่ใช่ตัวเลข (`validity.badInput`)

Spec: `docs/spec/08-admin-ui-medusa-components.md` (กฎ 15, AC-16; regression AC-6)
Commit ที่ตรวจ: `f61cf1a3` (merge `origin/develop` แล้ว) — prod build (`medusa build` + `medusa start` จาก `.medusa/server`)
Chromium 1280×800, `locale: en-US`, `timezoneId: Asia/Bangkok`, DB แยก, Stripe key ปลอม (ไม่ใช้ Stripe ใน flow นี้)

| AC | Result | Evidence |
|----|--------|----------|
| AC-16 drawer flash sale: Total cap / Per-customer limit = `e`, `1e` → error ใต้ช่อง "Must be a whole number greater than 0", ไม่มี POST `/config`; ล้างช่องแล้ว Save → POST 1 ครั้ง `total_cap: null` | pass | `qa313-total-cap-e-error.png`; e2e `admin-form-pilot.spec.ts` AC-16 #1 ผ่าน |
| AC-16 modal Create pool: Face value `e` → `evoucher-pool-face_value-error` "Must be a number of 0 or more"; Low-stock threshold `e` → "Must be a whole number of 0 or more"; ไม่มี POST `/admin/evoucher/pools` | pass | `qa313-pool-face-value-e-error.png`, `qa313-pool-edge-errors.png`; e2e AC-16 #2 ผ่าน |
| AC-16 static: ทั้งสอง widget import `NumberInput` จาก `components/common/number-input`, ไม่มี `Input type="number"` ในสอง widget | pass | jest `form-validation` + `medusa-ui` 112/112 ผ่าน; grep |
| AC-6 (regression) Total cap `0` error, dblclick = POST 1, ⌘+Enter = POST 1; Create pool ไม่เลือก partner = error, dblclick = POST 1 ด้วย body เดิม (`low_stock_threshold: 20`) | pass | e2e `admin-form-pilot.spec.ts` AC-6 ×2 ผ่านโดยไม่แก้ |

## Negative / edge (นอก spec — QA เพิ่ม, ไม่ commit test)
| กรณี | ผล |
|------|----|
| แก้จาก `e` เป็นค่าถูก (`5`, ปลายทาง `1e5`) → error หายและ Save ได้ POST 1 ครั้ง | pass (`total_cap: 100000, per_customer_limit: 5`) |
| วาง (insertText) `--1` / `e` → badInput → error, ไม่มี POST | pass |
| วาง `1.2.3` → Chromium ตัดเป็น `1.23` เอง (ไม่ใช่ badInput) → ช่อง int ขึ้น error whole number ถูกต้อง; ช่อง Face value รับ `1.23` เป็นค่าถูก | พฤติกรรมของ browser — ไม่ใช่ defect |
| วาง `1e5` (สัญกรณ์วิทยาศาสตร์ที่ถูก) → ไม่ใช่ badInput → POST `100000` | pass (สอดคล้องกับ browser) |
| พิมพ์ `e` แล้วกด Backspace จนว่าง ทั้งหลัง submit แล้วและก่อน submit → error ไม่ค้าง, Save ส่ง `null` | pass |
| ⌘/Ctrl+Enter ขณะ badInput (Per-customer `1e`, Low-stock `e`) → error, ไม่มี POST | pass (`qa313-meta-enter-badinput.png`) |
| ทศนิยมในช่อง int (`1.5`, `2.5`), ติดลบ (`-1`), `0` → error ใต้ช่อง ไม่มี POST; Face value `-1` → error | pass |
| พิมพ์ `e` + Save (error) แล้ว Esc ปิด drawer → เปิดใหม่ได้ค่าจาก server (`100000`) ไม่มี error ค้าง | pass |
| Low-stock default `20`; ArrowUp → `21`, ArrowDown ×2 → `19`; คลิก spinner (เมาส์) ขึ้น → `20` | pass |
| Face value `250.5` + Low-stock `7` → POST 1 ครั้ง body `face_value: 250.5, low_stock_threshold: 7`, pool แสดง "Manage codes" | pass (`qa313-pool-saved.png`) |

## Defect
ไม่พบ

## Test ที่รัน
- `apps/storefront/e2e/admin-form-pilot.spec.ts` 4/4 ผ่าน (AC-6 ×2, AC-16 ×2)
- QA edge `e2e/admin-ui/qa-313-adm12-edge.spec.ts` 3/3 ผ่าน (อยู่ใน worktree ของ QA เท่านั้น)
- jest `src/admin/lib/__tests__/form-validation.unit.spec.ts` + `src/admin/__tests__/medusa-ui.unit.spec.ts` 112/112 ผ่าน
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #313 (job e2e, 14 วัน)
