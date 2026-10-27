# CLAUDE.md — กฎของโปรเจกต์ (อ่านก่อนเริ่มทุก session)

## Language (ภาษา)
- **ตอบและสนทนากับ owner เป็นภาษาไทยเสมอ** ทุก agent (planner, builder, qa, reviewer) ด้วย
- เขียน **เป็นภาษาไทย**: ชื่อและเนื้อหา PR, commit message (คง prefix แบบ Conventional Commits เป็นอังกฤษ
  เช่น `feat:`, `fix:`, `chore:` แล้วตามด้วยคำอธิบายภาษาไทย), review comment, evidence `REPORT.md`,
  และเอกสารทั้งหมดใน `docs/` (spec, ADR, design, ROADMAP) รวมถึง `.claude/agents/*.md`
- คง **ภาษาอังกฤษ** สำหรับ: โค้ด, ชื่อตัวแปร/ไฟล์/branch, คำสั่ง, ชื่อ API/module ของ Medusa และศัพท์เทคนิค
  ที่ไม่มีคำไทยที่ใช้กันทั่วไป (ใส่ทับศัพท์ได้ เช่น workflow, middleware)
- ข้อความ UI ของ storefront เป็น**ภาษาไทยเขียนตรงในโค้ด** (ADR-014; ยังไม่มี i18n) label อังกฤษในเครื่องหมายคำพูดใน spec
  เป็นเพียงชื่อเรียก element; test/screenshot หา element ด้วย `data-testid` เสมอ ไม่ match ด้วยข้อความ และตรวจความเป็นไทยด้วย
  regex อักษรไทย admin (`src/admin/`) คงภาษาอังกฤษ

## โปรเจกต์นี้คืออะไร
ร้านค้า e-commerce ระดับ production ที่สร้าง **บน Medusa v2** (backend + admin) ร่วมกับ
storefront จาก **Medusa Next.js Starter** เราขยายความสามารถของ Medusa ไม่ได้สร้างขึ้นมาแทน

## ข้อห้ามที่ต่อรองไม่ได้ (จากเป้าหมายของ owner)
1. **ห้ามสร้างสิ่งที่ Medusa ทำได้ดีอยู่แล้วขึ้นมาใหม่** ก่อนเขียน module, service,
   workflow, API route หรือหน้า admin ให้ตรวจสอบ `docs/spec/01-core-medusa.md` และ
   Medusa docs ก่อน รวมถึง plugin/integration ของ Medusa, partner และ community ที่
   https://medusajs.com/integrations (ต้องรองรับ Medusa v2 เวอร์ชันที่ pin และเพิ่ม dependency ผ่าน spec/ADR) หาก Medusa มีให้แล้ว → ใช้/ขยายต่อ หากคิดว่าของ Medusa
   ไม่เพียงพอ → เขียน ADR ใน `docs/decisions/` ก่อน และต้องได้รับการอนุมัติ
   **หน้า admin (`src/admin/`) — ใช้ของ Medusa ตามลำดับนี้ก่อนเขียนเอง** (อ้างอิง https://docs.medusajs.com/resources/admin-components)
   1) `@medusajs/dashboard` (export ตั้งแต่ v2.21.0; เรา pin 2.22.1): `@medusajs/dashboard/components` (เช่น `ActionMenu`,
      `SectionRow`, `JsonViewSection`, `DisplayId`, empty states, `Listicle`, `Thumbnail`, `Form`, `KeyboundForm`, `Combobox`,
      `CountrySelect`, `RouteDrawer`, `RouteFocusModal`, `StackedDrawer`, `StackedFocusModal`, `ConfigurableDataTable`,
      `DataGrid`, `LayoutComposer`), `@medusajs/dashboard/hooks` (hook ของ resource Medusa + query key factory,
      `useQueryParams`, `useDate`, `useDebouncedSearch`, `useComboboxData`, data-table helpers) และ `@medusajs/dashboard/lib`
      (เงิน/สกุลเงินเช่น `getStylizedAmount`, ที่อยู่, form validation, table utilities, `defineSearchEntity`)
   2) primitive ของ `@medusajs/ui` (เช่น `DataTable`/`useDataTable`/`createDataTableColumnHelper`, `usePrompt`, `toast`,
      `FocusModal`, `Drawer`, `Container`, `Heading`, `StatusBadge`)
   3) ของที่ dashboard ไม่ export (เช่น Header) → ทำตาม "Custom Component Guides" ของหน้าเดียวกัน; **ห้าม copy โค้ดจากหน้า
      archive** (ถูกแทนด้วย export แล้ว)
   ดึงข้อมูล: resource ของ Medusa ใช้ hook ของ dashboard; route ของเราเองใช้ JS SDK + Tanstack Query (query key + invalidate)
   ฟอร์ม: `Form` ของ dashboard + react-hook-form + zod (สร้าง = FocusModal/RouteFocusModal, แก้ = Drawer/RouteDrawer)
   ห้ามเขียน component/hook/helper ซ้ำกับข้างบน (ตาราง, แบ่งหน้า, prompt, toast, client API, formatter เงิน/วันที่, form field)
   สร้างเองได้เฉพาะเมื่อไม่มีจริง พร้อมเหตุผลใน PR; shared component เก็บที่ `src/admin/components/common/` เมื่อมีผู้ใช้จริง ≥ 2 ที่;
   ของจาก Medusa ก็ยังต้องกันกดซ้ำตามกฎด้านล่าง — แผนปรับโค้ดเดิมดู ADR-018
2. **ทำตาม convention ของ Medusa**: module อยู่ใน `src/modules/`, workflow อยู่ใน
   `src/workflows/`, API route อยู่ใน `src/api/`, subscriber อยู่ใน `src/subscribers/`,
   scheduled job อยู่ใน `src/jobs/`, admin extension อยู่ใน `src/admin/`, link อยู่ใน
   `src/links/` service ต้อง extend `MedusaService` logic ที่ข้าม module ต้องอยู่ใน
   workflow (พร้อม compensation) ห้ามเรียก service ถึง service โดยตรง
3. **ห้าม over-engineering** ห้ามสร้าง abstraction จนกว่าจะมีการใช้งานจริงสองที่ ห้ามเพิ่ม
   infra ใหม่ (queue, cache, service) เว้นแต่ spec หรือ ADR กำหนดไว้
4. **TDD**: เขียน test ที่ fail ก่อน จากนั้นเขียนโค้ดให้น้อยที่สุดเพื่อให้ผ่าน แล้วจึง refactor
   unit test สำหรับ pure logic; integration test (`medusa-test-utils`) สำหรับ workflow
   และ API route; Playwright e2e สำหรับ flow ของ storefront
5. **ไม่มี guest** เฉพาะการดูเท่านั้นที่เป็นสาธารณะ ทุก store route ที่สร้างหรือเปลี่ยนแปลงสิ่งใด
   (รวมถึง cart) ต้องมี customer ที่ authenticate แล้ว store route ใหม่ต้องใช้ middleware
   `authenticate("customer", ...)` ของ Medusa route ของ affiliate portal ใช้ actor type
   `affiliate` แยกต่างหาก (`authenticate("affiliate", ...)`); affiliate ไม่ใช่ customer reviewer จะ block ทุก write route ที่ไม่มีการ authenticate
6. **ไม่มี evidence เท่ากับไม่เคยเกิดขึ้น** ทุก PR ต้องลิงก์ไปยัง spec และแสดงผลลัพธ์ของ test QA จัดทำเนื้อหา
   `docs/evidence/<feature>/<task-id>/REPORT.md` (session หลักเป็นผู้ commit ลง branch ของ PR — ดูบทเรียนด้านล่าง) (ตาราง AC + screenshot สำคัญ ≤ 5 รูป, PNG ≤ 300KB);
   Playwright report และ trace ฉบับเต็มเก็บเป็น CI artifact (14 วัน) ไม่เก็บใน git

## Medusa agent skills (ติดตั้งครั้งเดียวต่อเครื่อง)
skill ทางการของ Medusa ติดตั้งเป็น Claude Code plugin จาก marketplace `medusa`:
```bash
claude plugin marketplace add medusajs/medusa-agent-skills
claude plugin install medusa-dev@medusa            # building-with-medusa, admin customizations, storefronts, db-generate, db-migrate, new-user
claude plugin install ecommerce-storefront@medusa  # storefront-best-practices (UI/UX, SEO, mobile)
```
builder/planner ต้องโหลด `building-with-medusa` ก่อนทำงาน backend ใดๆ,
`building-admin-dashboard-customizations` สำหรับ `src/admin/` และ `building-storefronts` +
`storefront-best-practices` สำหรับ `apps/storefront` ใช้ `context7` (หรือ docs.medusajs.com) เพื่อตรวจสอบ
API แทนการเดา `learn-medusa` (tutorial) และ `medusa-cloud` (Medusa Cloud CLI) ตั้งใจ
ไม่ติดตั้ง เพราะเรา self-host ตาม `docs/spec/07-scaling-ops.md` MCP `MedusaDocs` ที่มาพร้อมกับ plugin
ต้อง login Medusa Cloud จึงถูกปิดไว้สำหรับโปรเจกต์นี้
(`disabledMcpServers` ใน `~/.claude.json`; ปิดผ่าน `/mcp` เมื่อใช้เครื่องใหม่)

## MCP servers (แชร์ผ่าน `.mcp.json` อนุมัติครั้งเดียวต่อเครื่องเมื่อรัน `claude` ครั้งแรก)
- `context7` — docs ล่าสุดของ Medusa v2, Next.js, Stripe, Playwright, Tailwind ฯลฯ ใช้ก่อนเดา API
- `playwright` — headless browser สำหรับ agent `qa` ใช้ควบคุม storefront และเก็บ evidence
- `stripe` — เครื่องมือ Stripe test mode (customers, payment intents, webhooks) อ่าน `STRIPE_SECRET_KEY` จาก shell ของคุณ ใช้ **test** key เท่านั้น
- `postgres` (dbhub) — อ่าน/query DB ของ Medusa ในเครื่อง ต่อ Postgres จาก Docker Compose ของโปรเจกต์นี้ (`postgres://medusa:medusa@localhost:5432/medusa` ระบุตรงใน `.mcp.json` ไม่อ่าน `DATABASE_URL` จาก shell) จะแสดง "failed" จนกว่า DB container จะทำงาน — ซึ่งเป็นเรื่องปกติ
GitHub ใช้งานผ่าน `gh` CLI ไม่ใช่ MCP server

## Stack
- Node.js 22+, TypeScript strict, pnpm workspaces (`apps/backend`, `apps/storefront`)
- Medusa v2 (pin เวอร์ชัน `@medusajs/*` แบบระบุแน่ชัดใน `package.json` ที่ root; bump ผ่าน ADR เท่านั้น)
- PostgreSQL 16, Redis 7 (event bus, workflow engine, cache, locking)
- Stripe (บัตรเครดิต + PromptPay ผ่าน `@medusajs/medusa/payment-stripe`)
- Next.js (Medusa starter), Tailwind, Playwright
- Docker Compose สำหรับ local; ดู `docs/spec/07-scaling-ops.md` สำหรับ prod

## Commands
```bash
pnpm install
pnpm --filter backend dev            # Medusa + admin on :9000
pnpm --filter storefront dev         # Next.js on :8000
pnpm --filter backend test:unit
pnpm --filter backend test:integration:http
pnpm --filter backend test:integration:modules
pnpm --filter storefront test:e2e    # Playwright, screenshots → docs/evidence/
pnpm lint && pnpm typecheck
pnpm --filter backend db:migrate && pnpm --filter backend seed
pnpm --filter backend build && pnpm --filter backend start   # prod-like
pnpm --filter storefront build && pnpm --filter storefront start
```

## Branching และ PR
- `main` = released แล้ว `develop` = integration feature branch ใช้ชื่อ `feat/<task-id>-<slug>` (เช่น `feat/GB-3-join-workflow`)
- หนึ่ง PR ต่อหนึ่ง task ใน task list ของ spec ขนาดเล็ก (diff < ~400 LOC) CI ต้องผ่าน (green)
- body ของ PR ทำตาม `.github/pull_request_template.md` agent ที่เปิด PR (builder/planner/qa/reviewer) ห้าม merge เอง
- **การ merge เข้า `develop`**: session หลักเป็นผู้ merge (owner อนุญาต 2026-10-25) เฉพาะเมื่อครบทุกข้อ: reviewer ให้
  APPROVE ไม่มี blocker, CI ทุก job เป็น `SUCCESS` หรือ `SKIPPED` ตามที่ `tools/ci/classify-changes.sh` ตัดสิน, task ที่มี UI ผ่าน qa (มี `REPORT.md`), dependency merge ครบ และ PR ไม่ CONFLICTING
  merge ทีละตัวตามลำดับ critical path แล้วแจ้ง owner ทุกครั้ง **การ merge เข้า `main` (release) owner เป็นผู้ทำเท่านั้น**
- Release = PR `develop → main` ติด tag `vX.Y.Z` changelog มาจากชื่อ PR
- **ก่อนเปิด branch ใหม่หรือเริ่ม task ใหม่ ต้องเช็ก dependency ก่อนเสมอ**: ดูคอลัมน์ Depends ในตาราง task ของ spec
  และ PR ที่เปิดอยู่ (`gh pr list`) ว่างานนี้ต้องใช้ PR ไหน (รวม PR เอกสาร/ADR/spec ที่งานนี้อ้างถึง และ hotfix ที่แก้ `develop`
  แดง — ดูนิยามในบทเรียนด้านล่าง) ถ้า PR นั้นยังไม่ merge เข้า `develop` → **ห้ามเริ่ม** ให้แจ้ง owner ว่าต้อง merge PR ไหน
  แล้วรอจนกว่าจะ merge จริง (เช็กด้วย `gh pr view <n> --json state`) ห้ามแตก branch จาก PR ที่ยังไม่ merge
  และห้ามอ่าน spec จาก branch ที่ยังไม่ merge แทน

## บทเรียนที่ต้องไม่ทำผิดซ้ำ (จากรอบ 2026-10-25/26)
**การ merge และ CI (session หลัก)**
- ก่อน merge **ทุก** job (`gh pr checks <n> --watch`) ต้องเป็น `SUCCESS` หรือ `SKIPPED` ตามที่ `classify-changes.sh`
  ตัดสิน — ห้ามมี FAILURE/CANCELLED/ค่าว่าง (conclusion ว่างใน `statusCheckRollup` = ยังรันอยู่ ไม่ใช่ผ่าน)
- merge ทีละตัว: ก่อน merge แต่ละ PR ต้อง merge `origin/develop` เข้า branch ของ PR (sync) แล้วรอ CI ของ PR นั้นเขียว
  — CI ไม่รันบน push ไป `develop` แล้ว (ทดสอบ tree เดียวกับ PR ที่ sync แล้วซ้ำ) ด่าน "develop เขียว" จึงคือ PR ที่ sync
  กับ develop ล่าสุดและ CI เขียว; ถ้าสิ่งที่ develop เปลี่ยนนับจาก merge-base เป็นเอกสารล้วนตามนิยามของ
  `tools/ci/classify-changes.sh` (`code=false`) ไม่ต้อง sync ใหม่
- PR สองตัวที่เขียวแยกกันอาจพังเมื่อรวมกัน (เช่น test สร้าง cart แบบ guest × PR ที่บังคับ login) → หลัง merge ตัวหนึ่ง
  ให้ merge `origin/develop` เข้า PR ถัดไปแล้วรอ CI ใหม่บน base ล่าสุด โดยเฉพาะเมื่อ PR ที่เพิ่ง merge เปลี่ยนกติกากลาง
  (auth, middleware, error handler, hook) — `gh pr merge` ไม่ re-run CI ให้
- `develop` แดง (= CI ของ PR ที่ sync กับ develop ล่าสุดล้มด้วยสาเหตุที่ไม่ใช่โค้ดของ PR นั้น หรือ run ของ `main` ล้ม —
  develop ไม่มี run ของตัวเองแล้ว) → หยุด merge ทุกอย่างแล้วทำ hotfix ก่อน อ่าน log จริงก่อนโทษ PR (เช่น `heap out of memory`/exit 134 คือ
  jest หน่วยความจำเต็ม ไม่ใช่ test ล้ม)
- conflict ที่ `medusa-config.ts` / `src/api/middlewares.ts` ให้เก็บทั้งสองฝั่ง แล้วรัน `test:unit` + `build` + `typecheck`
  ก่อน push (เคย resolve ผิดจน module หลุด)

**การสั่ง agent**
- reviewer/qa ต้องตรวจใน worktree ของตัวเอง (`git worktree add` ใน scratchpad) **ห้าม checkout ใน repo หลัก**
- builder รันในเครื่องเฉพาะ test ของตัวเอง + unit + build (เครื่องรับ integration พร้อมกันได้น้อย) ชุดเต็มให้ CI รัน
  และ merge/rebase `origin/develop` ครั้งเดียวก่อน push ห้ามไล่ develop
- ไฟล์ชั่วคราวใน scratchpad ต้องมี task id ในชื่อ (`pr-body-<TASK>.md`) — เคยเขียนทับกัน
- port / DB / Redis db ของแต่ละ agent ต้องไม่ซ้ำกัน และปิด server + drop DB เมื่อเสร็จ
- planner หลายตัวพร้อมกัน → ระบุไฟล์/เลข ADR ที่แต่ละตัวใช้ให้ชัด (เคยได้ ADR เลขเดียวกันสองฉบับ)
- qa เขียน `REPORT.md` ไม่ได้ (harness) → qa ส่งเนื้อหากลับ session หลัก commit ลง branch ของ PR
- builder push ครั้งเดียวเมื่อพร้อมเปิด PR (ไม่ push ระหว่างทาง) และแก้ตาม review ให้ครบแล้ว push ครั้งเดียว — ทุก push รัน CI
  ชุดเต็มและ cancel run ก่อนหน้า
- `develop` แดง (ตามนิยามด้านบน) → สั่ง builder ทุกตัวหยุด push จน hotfix merge (PR ที่ push ช่วงนั้นแดงเพราะ develop ไม่ใช่เพราะตัวเอง)
- session หลัก commit `REPORT.md` รวมกับการ sync develop ใน push เดียว
- CI ข้าม job หนักให้อัตโนมัติ: PR เอกสารล้วนรันแค่ `lint-typecheck`; PR ที่แก้แค่ `apps/storefront/**` ข้าม `backend-tests`/`docker-worker-mode`
  (กติกาใน `tools/ci/classify-changes.sh`) push ไป `main` รันครบเสมอ
- PR ที่แก้หลัง APPROVE (หรือหลัง REQUEST CHANGES) ต้อง re-review สั้นๆ ก่อน merge; หลัง rebase ใช้ `git range-diff`

**โค้ดและ test**
- key ของ `MedusaService({...})` ต้องตรงกับชื่อ model (Query ตั้งชื่อ method จากชื่อ entity) และมี test `query.graph`
- จำนวนเงินคำนวณด้วย `MathBN`/`raw_amount` เสมอ ห้ามใช้ `Number` float (refund 100.10 + 200.20 ≠ 300.30)
- `createHook` ของ Medusa มี handler ได้ตัวเดียว task ที่ใช้ hook เดียวกันต้องรวม handler
- หลัง CORE-6/CORE-12 test ที่สร้างหรือแก้ cart ต้องใช้ token ของ customer ที่เป็นเจ้าของ cart
  (`integration-tests/helpers/customer.ts`)
- ฟอร์ม/ปุ่ม admin และ API ที่สร้างข้อมูลต้องกันกดซ้ำ/ยิงพร้อมกัน (disable ระหว่างส่ง + lock หรือ idempotent ฝั่ง backend)
- Stripe ต้องตั้ง secret `STRIPE_TEST_API_KEY` และ `STRIPE_TEST_PUBLISHABLE_KEY` ของบัญชีเดียวกันพร้อมกัน (test mode เท่านั้น)
- `when(...)` ใน workflow ที่ `.then()` คืนค่า ต้องตั้งชื่อคงที่ `when("<ชื่อ>", ...)` (lint `@medusajs/when-block-must-have-name`)
  ไม่งั้น Medusa สร้าง step ชื่อสุ่ม `when-then-<ulid>` ทุกครั้งที่โหลด module → workflow async/retry ข้าม process (worker, restart) หา step ไม่เจอ
- `medusaIntegrationTestRunner` reset DB ก่อนทุก test → ข้อมูลที่สร้างใน `beforeAll` ของ `describe` ซ้อนจะหายหลัง test แรก
  ให้สร้างข้อมูลที่ test ต้องใช้ใน `beforeEach` (หรือสร้างใน test นั้นเอง)
- อย่าปล่อย error ของ axios หลุดออกจาก test (object มี circular reference → serialize เป็น JSON ไม่ได้ ทำให้ jest worker crash)
  ให้ catch แล้วห่อเป็น `Error` ธรรมดาที่มีเฉพาะ status/body เช่น `` new Error(`${status} ${JSON.stringify(data)}`) ``

## Agents (`.claude/agents/`)
- `planner` — แปลงเป้าหมายเป็น/อัปเดต spec + task list + ADR ไม่เขียนโค้ด
- `builder` — รับ task เพียงหนึ่งเดียว, TDD, worktree ของตัวเอง, เปิด PR
- `qa` — รัน e2e, เก็บ screenshot/trace, บันทึก evidence
- `reviewer` — review อย่างอิสระเทียบกับ spec; ไม่เคยเห็น context ของการ build
session หลักทำเพียงวางแผน, มอบหมายงาน และรวมผลลัพธ์ ไม่ถือโค้ดไว้ใน context

## ความจำของโปรเจกต์อยู่ที่ไหน
- `docs/spec/*.md` — สิ่งที่ต้องสร้างและ acceptance criteria (source of truth)
- `docs/decisions/ADR-*.md` — เหตุผล; ห้ามขัดแย้งกับ ADR ที่ยอมรับแล้วโดยไม่บอก
- `docs/ROADMAP.md` — ลำดับ milestone และสถานะ
- PR ที่เปิดอยู่ — งานที่กำลังดำเนินการ
session ใหม่อ่านสี่สิ่งนี้แล้วทำงานต่อได้โดยไม่ต้องมีประวัติแชท

## Definition of Done (ต่อ task)
- [ ] เขียน test ก่อนและผ่านทั้งหมด (unit + integration ตามที่เกี่ยวข้อง)
- [ ] lint/typecheck ผ่านไม่มี error
- [ ] ติ๊ก acceptance criteria ใน spec ครบ
- [ ] บันทึก evidence ไว้ภายใต้ `docs/evidence/<feature>/`
- [ ] เปิด PR ไปยัง `develop` พร้อมกรอก template ครบ
- [ ] reviewer อนุมัติแล้ว
