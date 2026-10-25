# CLAUDE.md — Project rules (read first, every session)

## What this is
Production e-commerce store built **on top of Medusa v2** (backend + admin) with the
**Medusa Next.js Starter** storefront. We extend Medusa; we do not replace it.

## Non-negotiables (from the owner's goals)
1. **Never rebuild what Medusa already does well.** Before writing a module, service,
   workflow, API route or admin page, check `docs/spec/01-core-medusa.md` and the
   Medusa docs. If Medusa has it → use/extend it. If you think Medusa's version is
   insufficient → write an ADR in `docs/decisions/` first and get it approved.
2. **Follow Medusa conventions**: modules in `src/modules/`, workflows in
   `src/workflows/`, API routes in `src/api/`, subscribers in `src/subscribers/`,
   scheduled jobs in `src/jobs/`, admin extensions in `src/admin/`, links in
   `src/links/`. Services extend `MedusaService`. Cross-module logic lives in
   workflows (with compensation), never in raw service-to-service calls.
3. **No over-engineering.** No abstraction until there are two real uses. No new
   infra (queues, caches, services) unless the spec or an ADR requires it.
4. **TDD**: write the failing test first, then the minimum code to pass, then refactor.
   Unit tests for pure logic; integration tests (`medusa-test-utils`) for workflows
   and API routes; Playwright e2e for storefront flows.
5. **No guests.** Only viewing is public. Every store route that creates or changes anything
   (carts included) requires an authenticated customer; new store routes must use Medusa's
   `authenticate("customer", ...)` middleware. Affiliate portal routes use the separate
   `affiliate` actor type (`authenticate("affiliate", ...)`); affiliates are not customers. Reviewer blocks any unauthenticated write route.
6. **Evidence or it didn't happen.** Every PR links its spec and shows test output. QA writes
   `docs/evidence/<feature>/<task-id>/REPORT.md` (AC table + key screenshots ≤ 5, PNG ≤ 300KB);
   full Playwright report and traces live as CI artifacts (14 days), not in git.

## Medusa agent skills (install once per machine)
Official Medusa skills are installed as Claude Code plugins from the `medusa` marketplace:
```bash
claude plugin marketplace add medusajs/medusa-agent-skills
claude plugin install medusa-dev@medusa            # building-with-medusa, admin customizations, storefronts, db-generate, db-migrate, new-user
claude plugin install ecommerce-storefront@medusa  # storefront-best-practices (UI/UX, SEO, mobile)
```
Builder/planner must load `building-with-medusa` before any backend work,
`building-admin-dashboard-customizations` for `src/admin/`, and `building-storefronts` +
`storefront-best-practices` for `apps/storefront`. Use `context7` (or docs.medusajs.com) to verify
APIs instead of guessing. `learn-medusa` (tutorial) and `medusa-cloud` (Medusa Cloud CLI) are
intentionally not installed; we self-host per `docs/spec/07-scaling-ops.md`. The plugin's bundled
`MedusaDocs` MCP requires a Medusa Cloud login, so it is disabled for this project
(`disabledMcpServers` in `~/.claude.json`; toggle it off via `/mcp` on a new machine).

## MCP servers (shared via `.mcp.json`, approve once per machine on first `claude` start)
- `context7` — up-to-date docs for Medusa v2, Next.js, Stripe, Playwright, Tailwind, etc. Use before guessing an API.
- `playwright` — headless browser for the `qa` agent to drive the storefront and capture evidence.
- `stripe` — Stripe test-mode tooling (customers, payment intents, webhooks). Reads `STRIPE_SECRET_KEY` from your shell; use a **test** key only.
- `postgres` (dbhub) — read/query the local Medusa DB. Reads `DATABASE_URL`, defaults to the Docker Compose Postgres. Shows "failed" until the DB container is up — that is expected.
GitHub is handled with the `gh` CLI, not an MCP server.

## Stack
- Node.js 22+, TypeScript strict, pnpm workspaces (`apps/backend`, `apps/storefront`)
- Medusa v2 (pin exact `@medusajs/*` version in root `package.json`; bump only via ADR)
- PostgreSQL 16, Redis 7 (event bus, workflow engine, cache, locking)
- Stripe (cards + PromptPay via `@medusajs/medusa/payment-stripe`)
- Next.js (Medusa starter), Tailwind, Playwright
- Docker Compose for local; see `docs/spec/07-scaling-ops.md` for prod

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

## Branching & PRs
- `main` = released. `develop` = integration. Feature branches `feat/<task-id>-<slug>` (e.g. `feat/GB-3-join-workflow`).
- One PR per task in the spec's task list. Small (< ~400 LOC diff). CI must be green.
- PR body follows `.github/pull_request_template.md`. Never merge your own PR —
  the owner merges.
- Release = PR `develop → main`, tagged `vX.Y.Z`, changelog from PR titles.

## Agents (`.claude/agents/`)
- `planner` — turns a goal into/updates a spec + task list + ADRs. Writes no code.
- `builder` — takes ONE task, TDD, own worktree, opens the PR.
- `qa` — runs e2e, captures screenshots/traces, files evidence.
- `reviewer` — independent review against the spec; has not seen the build context.
Main session only plans, dispatches, and merges results. It does not hold code in context.

## Where memory lives
- `docs/spec/*.md` — what to build and acceptance criteria (source of truth)
- `docs/decisions/ADR-*.md` — why; never silently contradict an accepted ADR
- `docs/ROADMAP.md` — milestone order and status
- Open PRs — current work in flight
A new session reads these four things and can continue without chat history.

## Definition of Done (per task)
- [ ] Tests written first and passing (unit + integration as applicable)
- [ ] Lint/typecheck clean
- [ ] Acceptance criteria in spec checked off
- [ ] Evidence saved under `docs/evidence/<feature>/`
- [ ] PR opened to `develop` with template filled
- [ ] Reviewer approved
