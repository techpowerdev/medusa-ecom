# CLAUDE.md — กฎของโปรเจกต์ (อ่านก่อนเริ่มทุก session)

## Language (ภาษา)
- **ตอบและสนทนากับ owner เป็นภาษาไทยเสมอ** ทุก agent (planner, builder, qa, reviewer) ด้วย
- เขียน **เป็นภาษาไทย**: ชื่อและเนื้อหา PR, commit message (คง prefix แบบ Conventional Commits เป็นอังกฤษ
  เช่น `feat:`, `fix:`, `chore:` แล้วตามด้วยคำอธิบายภาษาไทย), review comment, evidence `REPORT.md`,
  และเอกสารทั้งหมดใน `docs/` (spec, ADR, design, ROADMAP) รวมถึง `.claude/agents/*.md`
- คง **ภาษาอังกฤษ** สำหรับ: โค้ด, ชื่อตัวแปร/ไฟล์/branch, คำสั่ง, ชื่อ API/module ของ Medusa และศัพท์เทคนิค
  ที่ไม่มีคำไทยที่ใช้กันทั่วไป (ใส่ทับศัพท์ได้ เช่น workflow, middleware)
- UI label ที่ test/screenshot อ้างถึง (เช่น "Add to cart", "Sold out") คงเป็นอังกฤษใน spec จนกว่าจะตัดสินใจเรื่อง
  i18n ของ storefront

## โปรเจกต์นี้คืออะไร
ร้านค้า e-commerce ระดับ production ที่สร้าง **บน Medusa v2** (backend + admin) ร่วมกับ
storefront จาก **Medusa Next.js Starter** เราขยายความสามารถของ Medusa ไม่ได้สร้างขึ้นมาแทน

## ข้อห้ามที่ต่อรองไม่ได้ (จากเป้าหมายของ owner)
1. **ห้ามสร้างสิ่งที่ Medusa ทำได้ดีอยู่แล้วขึ้นมาใหม่** ก่อนเขียน module, service,
   workflow, API route หรือหน้า admin ให้ตรวจสอบ `docs/spec/01-core-medusa.md` และ
   Medusa docs ก่อน หาก Medusa มีให้แล้ว → ใช้/ขยายต่อ หากคิดว่าของ Medusa
   ไม่เพียงพอ → เขียน ADR ใน `docs/decisions/` ก่อน และต้องได้รับการอนุมัติ
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
6. **ไม่มี evidence เท่ากับไม่เคยเกิดขึ้น** ทุก PR ต้องลิงก์ไปยัง spec และแสดงผลลัพธ์ของ test QA เขียน
   `docs/evidence/<feature>/<task-id>/REPORT.md` (ตาราง AC + screenshot สำคัญ ≤ 5 รูป, PNG ≤ 300KB);
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
- body ของ PR ทำตาม `.github/pull_request_template.md` ห้าม merge PR ของตัวเอง —
  owner เป็นผู้ merge
- Release = PR `develop → main` ติด tag `vX.Y.Z` changelog มาจากชื่อ PR

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
