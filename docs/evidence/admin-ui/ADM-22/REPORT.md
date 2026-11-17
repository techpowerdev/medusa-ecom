# QA — ADM-22 ยืนยัน stack trace ของ loader หน้า pool บน build production (ไม่มี PR)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 28" กฎ 26 และ AC-27 (owner "ยืนยันก่อน" 2026-11-10 และสั่งทำ 2026-11-18)

## commit ที่ตรวจ
- `origin/develop` `9cd0770d39d6f7fc1d2ec5991643cd0e8f307dd2` (Merge PR #397) ไม่มี PR และไม่มีการแก้โค้ด
- route ที่ตรวจ: `apps/backend/src/admin/routes/evouchers/pools/[id]/page.tsx` ซึ่ง `loader` เรียก `evoucherApi.retrievePool` เป็น GET `/admin/evoucher/pools/<id>` (`lib/evoucher.ts`, `BASE = "/admin/evoucher"`)

## สภาพแวดล้อม
- worktree แยกของ qa ใน scratchpad ไม่ได้ checkout ใน repo หลัก
- **prod build**: `medusa build` แล้ว `medusa start` จาก `.medusa/server` (`NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) port 9315
  - รอบ A: build ด้วยคำสั่งตามกฎ 26 (`pnpm build` ไม่ตั้ง `NODE_ENV`) ได้ bundle `index-CUMOFusq.js`
  - รอบ B (เพื่อเทียบ): build ด้วย `NODE_ENV=production pnpm build` แล้ว start แบบเดียวกัน
- DB `medusa_qa_adm22` สร้างใหม่ แล้ว migrate + seed + admin user ที่ seed สร้าง; Redis db 15
- Node 22.23.3; Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, header `x-forwarded-proto: https` (เหมือน `ADMIN_UI_OPTIONS`)
- ไม่ใช้ Stripe (ใช้ key ปลอม `sk_test_dummy` แบบ CI)
- pool P สร้างผ่าน admin API ด้วย helper `createVoucher` (partner + variant + pool + import 1 code)
- จำลองความล้มเหลวด้วย `page.route` ที่ match pathname `/admin/evoucher/pools/<P>` ตรงตัว (ไม่โดน GET รายการ pool หรือ `/codes`)
- อ่านข้อความด้วย `document.body.innerText` และ `textContent` (รวม element ที่ซ่อน) หลังสั่งเปิด `<details>` ทุกอัน แล้วเทียบกับ regex `/\bat \S+ \(|\.(tsx?|m?js):\d+/`
- spec ชั่วคราวของ qa ไม่ได้ commit

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| control: เปิด `/app/evouchers/pools/<P>` ปกติ เห็นชื่อ pool และจำนวน code ต่อสถานะ | pass (รอบ A และ B) | spec ของ qa (ข้อความไม่ตรง regex) |
| AC-27 loader ตอบ 500 เปิดหน้าตรง (full load), build ตามกฎ 26 | **fail (ตรง regex)** | `01-default-build-500-full-load-stack.png` |
| AC-27 loader ตอบ 500 คลิกจากรายการ pool (client navigation), build ตามกฎ 26 | **fail (ตรง regex)** | spec ของ qa (หน้าเดียวกับรูป 01) |
| AC-27 `route.abort()` full load และ client navigation, build ตามกฎ 26 | **fail (ตรง regex)** | `02-default-build-abort-client-nav-stack.png` |
| AC-27 loader ตอบ 404 full load และ client navigation, build ตามกฎ 26 | **fail (ตรง regex)** | spec ของ qa |
| AC-27 loader ตอบ 401 (full load และ client navigation) ไป `/app/login` | pass (รอบ A และ B) | spec ของ qa (URL = `/app/login`) |
| เทียบ: ทุกเคสข้างบน (500/abort/404 × full/client) บน build ที่ตั้ง `NODE_ENV=production` | pass ไม่ตรง regex ทั้ง 6 เคส | `03-node-env-production-build-500-no-stack.png`, spec ของ qa 9/9 |

ข้อความที่หลุดบน build ตามกฎ 26 (คัดจาก `innerText`):
- 500: `500 - Internal server error ... Error Details (Development Mode) An unknown error occurred. Stack Trace Error: An unknown error occurred. at http://localhost:9315/app/assets/index-CUMOFusq.js:243:39913 at Generator.next (<anonymous>) at s (http://localhost:9315/app/assets/index-CUMOFusq.js:243:37217)`
- abort: `An error occurred ... Error Details (Development Mode) Failed to fetch Stack Trace TypeError: Failed to fetch at Ydt.<anonymous> (http://localhost:9315/app/assets/index-CUMOFusq.js:248:10) ...`
- 404: `404 - There is no page at this address ... Error Details (Development Mode) Pool with id: x was not found Stack Trace Error: Pool with id: x was not found at http://localhost:9315/app/assets/index-CUMOFusq.js:243:39913 ...`

บน build ที่ตั้ง `NODE_ENV=production` เหลือแค่หัวข้อกับคำอธิบาย เช่น `500 - Internal server error An unexpected error occurred on the server. Please try again later.` ไม่มี `<pre>/<code>` และไม่มี stack ใน HTML

## สาเหตุ (ตรวจจาก source ของ dependency ที่ pin 2.22.1)
- `@medusajs/dashboard` `error-boundary.tsx`: `isDevelopment = process.env.NODE_ENV === "development"` ใช้ตัดสินว่าจะแสดง "Error Details (Development Mode)" และ stack
- `@medusajs/cli` `create-cli.js` ใน handler ของคำสั่ง `build`: `process.env.NODE_ENV = process.env.NODE_ENV || "development"` ทำให้ `medusa build` ที่ไม่ได้ตั้ง `NODE_ENV` ไว้ build admin ด้วยค่า `development` และค่านี้ถูกใส่ลงใน bundle ตายตัว
- ค่า `NODE_ENV=production` ตอน `medusa start` ไม่มีผล เพราะ bundle ของ admin build เสร็จไปแล้ว
- bundle รอบ A มีข้อความ "Development Mode" 1 จุด ส่วนรอบ B มี 0 จุด

## edge / negative
- **401**: ทั้ง full load และ client navigation ไป `/app/login` ไม่มี stack (ทั้งสองรอบ)
- **client navigation กับ full load**: ได้หน้าเดียวกันทุกเคส ไม่มีทางไหนที่แสดงต่างกัน
- **`<details>` และ element ที่ซ่อน**: ไม่มี `<details>` ใน error page และ `textContent` ตรงกับ `innerText` ในส่วนที่เป็น stack (ไม่มี stack ซ่อนอยู่บน build รอบ B)
- **source map**: ไม่มีไฟล์ `.map` และไม่มี `sourceMappingURL` ใน `public/admin/assets` สิ่งที่หลุดจึงเป็นแค่ URL ของ bundle ที่ minify แล้วกับ line:col และข้อความ error จาก API ไม่มีชื่อไฟล์ `.tsx` หรือ path ของ source จริง

## defect
**D-1 (เข้ากฎ 26b) build production ตามคำสั่งในกฎ 26 / CLAUDE.md แสดง stack trace ใน `ErrorBoundary` ของ admin**
- ทำซ้ำ:
  1. `pnpm --filter backend build` (ไม่ตั้ง `NODE_ENV`)
  2. `cd apps/backend/.medusa/server && NODE_ENV=production npx medusa start`
  3. login admin
  4. ใช้ `page.route` ให้ GET `/admin/evoucher/pools/<P>` ตอบ 500
  5. เปิด `/app/evouchers/pools/<P>`
- expected: หน้า error ไม่มี stack หรือ path (ไม่ตรง regex ของ AC-27)
- actual: มีกล่อง "Error Details (Development Mode)" พร้อม `Stack Trace ... at http://.../app/assets/index-*.js:243:39913` ตรง regex ทั้ง 500/abort/404 และทั้ง full load และ client navigation
- ขอบเขต: เป็นผลระดับ build ไม่ได้เกิดเฉพาะ loader ของหน้า pool ทุก route ของ admin (รวมหน้า core ของ Medusa) ที่ตกไปที่ `ErrorBoundary` น่าจะแสดงแบบเดียวกัน (อนุมานจาก source ยังไม่ได้ทดสอบหน้าอื่น)
- `apps/backend/Dockerfile` stage `build` รัน `pnpm --filter @dtc/backend build` โดยไม่ได้ตั้ง `NODE_ENV` (ตั้ง `ENV NODE_ENV=production` แค่ใน stage `runtime`) image จริงจึงน่าจะได้ admin แบบ dev ด้วย (อนุมานจาก Dockerfile และ CLI ยังไม่ได้ build image จริง) step "Start backend" ของ e2e ใน CI (`.github/workflows/ci.yml`) ก็ build แบบเดียวกัน
- ผลการตัดสิน: owner เลือกแก้ที่การ build (2026-11-18) — ดู spec 07 หัวข้อ "Follow-up รอบ 35" (ไม่เปิด ADM-22b)

## ข้อสังเกต (ไม่บล็อก)
- **O-1**: admin bundle ของรอบ A ใหญ่กว่ารอบ B ประมาณ 336KB (10668KB เทียบกับ 10332KB) และมีโค้ดส่วน dev อยู่ด้วย เป็นอีกเหตุผลที่ควร build ด้วย `NODE_ENV=production`
- **O-2**: ข้อความที่หลุดไม่มี secret หรือ path ของเครื่อง/source แต่มีข้อความ error ดิบจาก API (เช่น `Pool with id: x was not found`) และโครงสร้าง bundle ความเสี่ยงจึงต่ำ และอยู่หลัง login admin
- **O-3**: error page ของ `ErrorBoundary` เป็นหน้าเต็มที่ไม่มี sidebar หรือปุ่มกลับ (ทั้งสองรอบ) ผู้ใช้ต้องกด back ของ browser
- **O-4**: ข้อความ 404 ของ dashboard คือ "There is no page at this address" ซึ่งชวนเข้าใจผิดเมื่อ route มีอยู่แต่ pool ไม่มี เป็นพฤติกรรมของ dashboard

## evidence (3 รูป, PNG 1280×800, ทุกรูปไม่เกิน 38KB)
- `01-default-build-500-full-load-stack.png` — build ตามกฎ 26, loader ตอบ 500, เปิดหน้าตรง เห็น "Error Details (Development Mode)" และ Stack Trace
- `02-default-build-abort-client-nav-stack.png` — build ตามกฎ 26, `route.abort()`, คลิกจากรายการ pool เห็น `TypeError: Failed to fetch` และ stack
- `03-node-env-production-build-500-no-stack.png` — build ด้วย `NODE_ENV=production`, loader ตอบ 500 เหลือแค่ "500 - Internal server error" ไม่มี stack
