# QA — OPS-27 build backend ด้วย NODE_ENV=production (PR #399)

Spec: `docs/spec/07-scaling-ops.md` หัวข้อ "Follow-up รอบ 35" กฎ (a)–(e) และ AC-42 (เน้น AC-42c) — ที่มา `docs/evidence/admin-ui/ADM-22/REPORT.md` D-1 (ใช้วิธีเดียวกันทุกเคส)

## commit ที่ตรวจ
- `origin/feat/OPS-27-prod-build-node-env` `564bcaca` (base `a7be88de` Merge PR #398)
- ไฟล์ที่เปลี่ยน: `apps/backend/Dockerfile`, `.github/workflows/ci.yml`, `CLAUDE.md` (บรรทัด prod-like), `apps/backend/src/__tests__/ci-workflow.unit.spec.ts`

## สภาพแวดล้อม
- worktree แยกของ qa ใน scratchpad ไม่ได้ checkout ใน repo หลัก
- **prod build ตามคำสั่ง prod-like ใหม่ (กฎ d)**: `NODE_ENV=production pnpm --filter backend build` → `medusa start` จาก `.medusa/server` (`NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) port 9317
  - env ของ guard ใน shell เป็นค่าปลอมแบบ CI (`AFFILIATE_TOKEN_SECRET`, `EVOUCHER_ENCRYPTION_KEY` 64 hex, `STOREFRONT_URL`, `JWT_SECRET`/`COOKIE_SECRET`, `STRIPE_API_KEY=sk_test_dummy`) ไม่ใช้ secret จริงและไม่ใช้ Stripe
- DB `medusa_qa399` สร้างใหม่ แล้ว migrate + seed + admin user ที่ seed สร้าง; Redis db 14
- Node 22.23.3; Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, header `x-forwarded-proto: https` (`ADMIN_UI_OPTIONS`)
- pool P สร้างผ่าน admin API ด้วย helper `createVoucher` (partner + variant + pool + import 1 code)
- จำลองความล้มเหลวด้วย `page.route` ที่ match pathname `/admin/evoucher/pools/<P>` ตรงตัว เฉพาะ GET
- อ่านข้อความด้วย `document.body.innerText` และ `textContent` หลังเปิด `<details>` ทุกอัน แล้วเทียบกับ regex `/\bat \S+ \(|\.(tsx?|m?js):\d+/`
  - ตรวจเพิ่มว่าไม่มี "Development Mode" และไม่มี `<pre>`/`<code>` ใน HTML
- spec ชั่วคราวของ qa ไม่ได้ commit
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #399 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| control: เปิด `/app/evouchers/pools/<P>` ปกติ (เปิดตรง + คลิกจากรายการ) เห็นชื่อ pool และจำนวน code | pass | spec ของ qa (ข้อความไม่ตรง regex, console error 0) |
| AC-42c loader ตอบ 500 เปิดหน้าตรง | pass ไม่มี stack / Development Mode | `01-prod-build-500-full-load-no-stack.png` |
| AC-42c loader ตอบ 500 คลิกจากรายการ pool | pass | spec ของ qa (ได้หน้าเดียวกับรูป 01) |
| AC-42c `route.abort()` เปิดหน้าตรง และคลิกจากรายการ | pass ("An error occurred / An unexpected error occurred while rendering this page.") | `02-prod-build-abort-client-nav-no-stack.png` |
| AC-42c loader ตอบ 404 เปิดหน้าตรง และคลิกจากรายการ | pass ("404 - There is no page at this address ...") | spec ของ qa |
| AC-42c loader ตอบ 401 เปิดหน้าตรง และคลิกจากรายการ → `/app/login` | pass (หน้า login ไม่ตรง regex) | spec ของ qa (URL = `/app/login`) |
| AC-42c หน้าของ Medusa `/app/products/prod_ops27_missing` | pass แสดง 404 ใน layout ไม่มี stack | `03-prod-build-medusa-product-missing-no-stack.png` |
| bundle จาก build ใหม่: `.medusa/server/public/admin/assets/*.js` | pass มี 348 ไฟล์, มี "Development Mode" 0 ไฟล์, ไม่มี `.map`/`sourceMappingURL`, 10332KB | ตรวจด้วย grep (ดูขั้นตอนด้านล่าง) |
| regression บน build production: login, หน้า e-voucher / affiliate / group buy, สร้าง partner ผ่านฟอร์ม 1 รายการ (POST 200 แถวขึ้นในตาราง แล้วลบ) | pass | spec ของ qa |
| regression ADM-27: `e2e/admin-form-discard-prompt.spec.ts` + `e2e/evoucher-admin-pool-page.spec.ts` บน build ใหม่ | pass 19/19 | ผล Playwright ในเครื่อง |
| (ไม่บังคับ) `docker build` จาก Dockerfile ของ branch โดยไม่มี env ใด | pass build ผ่าน; `/app/public/admin/assets` มี 348 `.js`, "Development Mode" 0; `/app` นอก `node_modules` ไม่มี `build-only`; env ของ image ไม่มี placeholder | ตรวจใน container (ดูขั้นตอนด้านล่าง) |

spec ของ qa รวม 11/11 passed บน build ใหม่

ขั้นตอนตรวจ bundle และ image:
- bundle: `ls .../assets/*.js | wc -l` = 348 และ `grep -lF "Development Mode" .../assets/*.js | wc -l` = 0
- image: `docker run --entrypoint sh` แล้ว `grep -lF "Development Mode" /app/public/admin/assets/*.js` และ `grep -rlF --exclude-dir=node_modules build-only /app` ไม่พบทั้งคู่; ตรวจ env ด้วย `docker image inspect`

## เทียบกับ build แบบเดิม (ยืนยันว่า test จับได้จริง)
ใช้ worktree และ DB เดิม แต่ build ด้วยคำสั่งเดิม `pnpm --filter backend build` (ไม่ตั้ง `NODE_ENV`) แล้ว start แบบเดียวกัน:
- bundle มี "Development Mode" 1 ไฟล์ ขนาด 10668KB (ตรงกับ ADM-22 รอบ A)
- spec เดิมของ qa เคส 500 เปิดหน้าตรง **fail** ด้วย `Error Details (Development Mode) ... at http://localhost:9317/app/assets/index-CJjG8x0m.js:243:39913`
- เคส control และ regression ยังผ่าน
- สรุปผล red/green: build เดิม = มี stack, build ใหม่ = ไม่มี stack

## edge / negative
- **401**: ทั้งเปิดหน้าตรงและคลิกจากรายการไป `/app/login` ไม่มี stack
- **เปิดหน้าตรงกับคลิกจากรายการ**: ได้หน้าเดียวกันทุกเคส (500/abort/404)
- **`<details>` และ element ที่ซ่อน**: ไม่มี `<details>`, `<pre>` หรือ `<code>` ใน error page; `textContent` ไม่ตรง regex เช่นเดียวกับ `innerText`
- **หน้าของ Medusa**: product ที่ไม่มีแสดง 404 ภายใน layout (มี sidebar) ไม่มี stack
- **image ไม่ส่ง env ตอนรัน**: `docker run medusa-ecom-backend:qa399 start` ออกด้วย exit 1 — guard ตอนบูตยังทำงาน placeholder ไม่หลุดไปถึง runtime
- **placeholder ใน image**: `docker image inspect` env มีแค่ `NODE_ENV=production` (และค่าของ base image) ไม่มีคำ `build-only` ใน history ของ image สุดท้าย (multi-stage)

## defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
- **O-1 console error ที่มีอยู่เดิม**: หลังเปิดฟอร์ม Create partner มี error ใน console จาก Radix ``"`DialogContent` requires a `DialogTitle` ..."`` — เจอทั้งบน build ใหม่และ build แบบเดิม จึงไม่ใช่ error ใหม่จาก PR นี้; เป็นเรื่อง a11y ของฟอร์มสร้าง (`FocusModal`) — เสนอให้เพิ่มใน followups backlog
- **O-2 test ที่ compile แล้วติดไปใน output/image**: `.medusa/server/src/__tests__/*.unit.spec.js` (รวม `ci-workflow.unit.spec.js`) อยู่ใน image ที่ `/app/src/__tests__/`; คำ `build-only` ไม่มีในไฟล์เพราะ test ประกอบคำจากส่วนย่อย — ถ้าในอนาคตมีใครเขียน `build-only` ตรงๆ ในไฟล์ใต้ `src/` ขั้นตรวจ image จะแดง; การ ship test ไปใน image เป็นเรื่องเดิมก่อน PR นี้ (นอกขอบเขต OPS-27)
- **O-3**: assets ใน image 10356KB ส่วน build ในเครื่อง 10332KB ต่างกันเล็กน้อย น่าจะมาจาก node patch ที่ต่างกัน (image 22.23.4 / เครื่อง 22.23.3) ไม่มีผลต่อ AC
- **O-4**: ข้อสังเกต UX จาก ADM-22 ยังเหมือนเดิม — error page เต็มหน้าไม่มี sidebar และข้อความ 404 "There is no page at this address" เป็นพฤติกรรมของ dashboard

## evidence (3 รูป, PNG 1280×800, ไม่เกิน 47KB)
- `01-prod-build-500-full-load-no-stack.png` — build ใหม่, loader ตอบ 500, เปิดหน้าตรง: เหลือ "500 - Internal server error" ไม่มี stack
- `02-prod-build-abort-client-nav-no-stack.png` — build ใหม่, `route.abort()`, คลิกจากรายการ pool: "An error occurred" ไม่มี stack
- `03-prod-build-medusa-product-missing-no-stack.png` — build ใหม่, `/app/products/prod_ops27_missing`: 404 ใน layout ของ Medusa ไม่มี stack
