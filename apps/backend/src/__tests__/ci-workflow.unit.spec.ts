import { execFileSync, spawnSync } from "child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"
import { parse } from "yaml"

// OPS-14: ลดเวลา CI ต่อ PR — storefront-e2e รันขนานกับ backend, integration:http แบ่ง shard,
// job `backend-tests` คงไว้เป็นตัวรวมผล และ shard ทุกตัวรวมกันต้องรัน test ครบเท่าเดิม
// OPS-16 (AC-27c): อ่าน ci.yml ด้วย parser YAML (ไม่ผูกกับการจัดย่อหน้า/รูปแบบ needs)
const BACKEND_DIR = path.resolve(__dirname, "../..")
const REPO_DIR = path.resolve(BACKEND_DIR, "../..")
const JEST_BIN = require.resolve("jest/bin/jest")

type Step = {
  id?: string
  name?: string
  uses?: string
  run?: string
  if?: unknown
  shell?: string
  env?: Record<string, string>
  with?: Record<string, string>
  "continue-on-error"?: unknown
}
type Job = {
  needs?: string | string[]
  if?: string
  strategy?: { matrix?: { include?: Record<string, string>[] } }
  steps?: Step[]
}

const ci = parse(readFileSync(path.join(REPO_DIR, ".github/workflows/ci.yml"), "utf8")) as {
  jobs: Record<string, Job>
}
const jobs = ci.jobs

const needsOf = (job: Job): string[] => ([] as string[]).concat(job.needs ?? [])
const stepsOf = (id: string): Step[] => jobs[id]?.steps ?? []
const matrixRuns = (job: Job): string[] => (job.strategy?.matrix?.include ?? []).map((m) => m.run ?? "")
/** index ของ step ที่ `run:` เป็นคำสั่งนี้คำสั่งเดียว */
const runIndex = (steps: Step[], cmd: string) => steps.findIndex((s) => s.run?.trim() === cmd)

/** step ที่ต้องรันทุกครั้งที่ขั้นก่อนหน้าผ่าน และผลไม่ถูกกลืน (ไม่มี if/continue-on-error/|| true) */
function expectUnconditional(step: Step | undefined) {
  expect(step).toBeDefined()
  expect(step).not.toHaveProperty("if")
  expect(step).not.toHaveProperty("continue-on-error")
  expect(step?.run).not.toMatch(/\|\|\s*true/)
}

function listTests(testType: string, shard?: string): string[] {
  const args = [JEST_BIN, "--listTests", ...(shard ? [`--shard=${shard}`] : [])]
  return execFileSync(process.execPath, args, {
    cwd: BACKEND_DIR,
    env: { ...process.env, TEST_TYPE: testType },
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .sort()
}

describe("OPS-14 ci.yml", () => {
  const shardJobs = Object.keys(jobs).filter((id) =>
    matrixRuns(jobs[id]).some((r) => /test:integration:http --shard=/.test(r))
  )

  it("storefront-e2e ไม่รอ job ของ backend tests (รันขนาน)", () => {
    const needs = needsOf(jobs["storefront-e2e"])
    expect(needs).toEqual(expect.arrayContaining(["changes", "lint-typecheck"]))
    expect(needs.filter((n) => /^backend/.test(n))).toEqual([])
  })

  it("integration:http แบ่ง shard ใน matrix และ shard รวมกันครบทุกไฟล์ไม่ซ้ำ", () => {
    const shards = shardJobs
      .flatMap((id) => matrixRuns(jobs[id]))
      .flatMap((r) => [...r.matchAll(/test:integration:http --shard=(\d+)\/(\d+)/g)])
    expect(shards.length).toBeGreaterThan(1)
    const total = Number(shards[0][2])
    expect(shards.map((s) => Number(s[2]))).toEqual(shards.map(() => total))
    expect(shards.map((s) => Number(s[1])).sort()).toEqual(Array.from({ length: total }, (_, i) => i + 1))

    const union = shards.flatMap((s) => listTests("integration:http", `${s[1]}/${s[2]}`)).sort()
    expect(union).toEqual(listTests("integration:http"))
  })

  it("ยังรัน test:unit และ test:integration:modules ใน CI", () => {
    const runs = shardJobs.flatMap((id) => matrixRuns(jobs[id])).join("\n")
    expect(runs).toMatch(/pnpm --filter backend test:unit\b/)
    expect(runs).toMatch(/pnpm --filter backend test:integration:modules\b/)
  })

  it("job backend-tests เป็นตัวรวมผลที่รอทุก shard และ fail เมื่อ shard ไม่ success", () => {
    const job = jobs["backend-tests"]
    expect(job).toBeDefined()
    expect(shardJobs.length).toBeGreaterThan(0)
    expect(needsOf(job)).toEqual(expect.arrayContaining([...shardJobs, "changes"]))
    // !cancelled(): ไม่ถูกข้ามเงียบเมื่อ shard ล้ม แต่ยังเป็น SKIPPED เมื่อ classify-changes ตัดสิน backend=false
    expect(job.if).toMatch(/!cancelled\(\).*needs\.changes\.outputs\.backend == 'true'/)
    const runs = stepsOf("backend-tests").map((s) => s.run ?? "").join("\n")
    expect(runs).toMatch(/exit 1/)
  })
})

// OPS-15 (AC-26): job integration ของ backend เก็บ log ของ test แล้วนับบรรทัด error ของ knex
// ที่เกิดจาก connection ถูก terminate — fail เมื่อ > 0 (แก้ที่ต้นเหตุ ไม่กรอง/ปิด log)
describe("OPS-15 ci.yml นับ log connection ของ knex", () => {
  const steps = stepsOf("backend-suites")
  const countStep = steps.find((s) => /OPS-15/.test(s.name ?? ""))
  const pattern = /grep -c "([^"]+)"/.exec(countStep?.run ?? "")?.[1]

  it("ขั้นรัน test เขียน log ลงไฟล์ (shell: bash = -eo pipefail คง exit code ของ jest)", () => {
    const testStep = steps.find((s) => /matrix\.run/.test(s.run ?? ""))
    expect(testStep?.shell).toBe("bash")
    expect(testStep?.env?.TEST_LOG).toBeDefined()
    expect(testStep?.run).toMatch(/\{ \$\{\{ matrix\.run \}\}; \} 2>&1 \| tee "?\$TEST_LOG"?/)
  })

  it("มีขั้นนับที่รันแม้ test ล้ม และ exit 1 เมื่อจำนวน > 0", () => {
    expect(countStep?.if).toBe("${{ !cancelled() }}")
    expect(pattern).toMatch(/ended unexpectedly/)
    expect(countStep?.run).toMatch(/-gt 0/)
    expect(countStep?.run).toMatch(/exit 1/)
  })

  it("สตริงที่นับไม่อยู่ในโค้ดส่วนอื่น (ไม่แก้ด้วยการกรอง/ปิด log)", () => {
    const out = execFileSync("git", ["grep", "-l", "-F", pattern ?? "", "--", ".", ":!docs"], {
      cwd: REPO_DIR,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
    expect(out).toEqual([".github/workflows/ci.yml"])
  })
})

// OPS-12 (AC-19): job docker-worker-mode รัน smoke ของ Redis event bus ขาด (OPS-8) หลัง smoke worker mode (OPS-1)
// ขั้นที่ไม่มี `if:` รันเฉพาะเมื่อขั้นก่อนหน้าผ่าน และ script exit ≠ 0 → job ล้ม
describe("OPS-12 ci.yml รัน smoke-redis-outage.sh", () => {
  const steps = stepsOf("docker-worker-mode")
  const worker = runIndex(steps, "tools/ops/smoke-worker-mode.sh")
  const outage = runIndex(steps, "tools/ops/smoke-redis-outage.sh")

  it("มีขั้นรัน tools/ops/smoke-redis-outage.sh หลัง tools/ops/smoke-worker-mode.sh", () => {
    expect(worker).toBeGreaterThanOrEqual(0)
    expect(outage).toBeGreaterThan(worker)
  })

  it("ขั้น smoke-redis-outage ไม่ถูกข้ามหรือกลืนผล (ไม่มี if, continue-on-error หรือ || true)", () => {
    // review #172: `if: false` ทำให้ขั้นถูกข้ามแต่ job ยังเขียว
    expectUnconditional(steps[outage])
  })
})

// OPS-16 (AC-27a): lint-typecheck รัน check-stripe-events.sh ตัวจริงกับไฟล์ของ repo (ค่า default ของ script)
// ไม่ใช่แค่ test ของ script
describe("OPS-16 ci.yml ตรวจ Stripe events ตัวจริง", () => {
  const steps = stepsOf("lint-typecheck")

  it("มีขั้นรัน tools/ci/check-stripe-events.sh (ไม่มี argument = docs/ops/production.md × ci.yml)", () => {
    expect(runIndex(steps, "tools/ci/check-stripe-events.test.sh")).toBeGreaterThanOrEqual(0)
    expectUnconditional(steps[runIndex(steps, "tools/ci/check-stripe-events.sh")])
  })
})

// OPS-16 (AC-27b): storefront-e2e cache browser ของ Playwright (key มีเวอร์ชัน @playwright/test จาก lockfile)
// cache hit → ติดตั้งเฉพาะ system deps ไม่ดาวน์โหลด browser ซ้ำ
describe("OPS-16 ci.yml cache browser ของ Playwright", () => {
  const steps = stepsOf("storefront-e2e")
  const cacheIdx = steps.findIndex((s) => /^actions\/cache@/.test(s.uses ?? ""))
  const cache = steps[cacheIdx]
  const versionStepId = /steps\.([\w-]+)\.outputs\.version/.exec(cache?.with?.key ?? "")?.[1]
  const versionStep = steps.find((s) => s.id === versionStepId)
  const installs = steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => /playwright install/.test(s.run ?? ""))
  const hit = `steps.${cache?.id}.outputs.cache-hit`

  it("cache โฟลเดอร์ ms-playwright ด้วย key ที่มีเวอร์ชันจาก step ที่อ่าน pnpm-lock.yaml", () => {
    expect(cache?.with?.path).toMatch(/ms-playwright/)
    expect(versionStep?.run).toMatch(/pnpm-lock\.yaml/)
  })

  it("step อ่านเวอร์ชันได้ค่าเดียวกับ @playwright/test ของ storefront", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "ops16-"))
    try {
      const out = path.join(tmp, "out")
      execFileSync("bash", ["-eo", "pipefail", "-c", versionStep?.run ?? "exit 1"], {
        cwd: REPO_DIR,
        env: { ...process.env, GITHUB_OUTPUT: out },
      })
      const pkg = JSON.parse(readFileSync(path.join(REPO_DIR, "apps/storefront/package.json"), "utf8"))
      expect(readFileSync(out, "utf8")).toBe(`version=${pkg.devDependencies["@playwright/test"]}\n`)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it("cache miss → install --with-deps; cache hit → install-deps เท่านั้น (หลัง restore cache)", () => {
    expect(installs.length).toBe(2)
    for (const { i } of installs) expect(i).toBeGreaterThan(cacheIdx)
    const miss = installs.find(({ s }) => s.if === `${hit} != 'true'`)?.s
    const onHit = installs.find(({ s }) => s.if === `${hit} == 'true'`)?.s
    expect(miss?.run).toMatch(/playwright install --with-deps chromium/)
    expect(onHit?.run).toMatch(/playwright install-deps chromium/)
    expect(onHit?.run).not.toMatch(/playwright install(?!-deps)/)
  })
})

// OPS-27 (AC-42a): `medusa build` ที่ไม่ตั้ง NODE_ENV ได้ admin แบบ development (stack trace ในหน้า error — qa ADM-22)
// → ตั้ง NODE_ENV=production เฉพาะขั้น build (Dockerfile, CI, คำสั่ง prod-like ใน CLAUDE.md); install/deploy ไม่เปลี่ยน
// Dockerfile: guard ตอนโหลด config ได้ placeholder inline ในบรรทัด build เท่านั้น (Q-O6 = ก) ไม่ปิด guard ของ provider ทดสอบ
describe("OPS-27 build backend ด้วย NODE_ENV=production", () => {
  const dockerfile = readFileSync(path.join(BACKEND_DIR, "Dockerfile"), "utf8")
  /** คำสั่ง Dockerfile แบบ logical line (รวมบรรทัดที่ต่อด้วย `\`, ตัด comment) แยกตาม stage */
  const stages: Record<string, string[]> = {}
  let stage = ""
  for (const line of dockerfile.replace(/\\\r?\n/g, " ").split("\n")) {
    const text = line.trim()
    if (!text || text.startsWith("#")) continue
    const from = /^FROM\s+\S+\s+AS\s+(\S+)/i.exec(text)
    if (from) stage = from[1]
    ;(stages[stage] ??= []).push(text)
  }
  const runs = (name: string, pattern: RegExp) =>
    (stages[name] ?? []).filter((l) => /^RUN\s/.test(l) && pattern.test(l))
  const [buildRun] = runs("build", /pnpm --filter @dtc\/backend build/)
  // คำ placeholder ประกอบจากส่วนย่อย: CI ตรวจว่า /app ของ image ไม่มีคำนี้ (AC-42b) — หลัง OPS-29 ไฟล์ test ไม่เข้า image แล้ว
  // แต่ .medusa/server ของ build ในเครื่อง/CI ยังมีไฟล์ test ที่ compile แล้ว จึงคงการประกอบคำไว้
  const PLACEHOLDER = ["build", "only"].join("-")

  it("Dockerfile stage build: บรรทัด RUN ที่ build backend ตั้ง NODE_ENV=production inline ก่อน pnpm", () => {
    expect(runs("build", /pnpm --filter @dtc\/backend build/)).toHaveLength(1)
    expect(buildRun).toMatch(/^RUN\s+(\S+=\S+\s+)*NODE_ENV=production\s+(\S+=\S+\s+)*pnpm --filter @dtc\/backend build/)
  })

  it("Dockerfile: pnpm install และ deploy --prod ไม่ได้รับ NODE_ENV; stage base/build ไม่มี ENV/ARG NODE_ENV", () => {
    const install = runs("build", /pnpm install/)
    const deploy = runs("build", /deploy --prod/)
    expect(install).toHaveLength(1)
    expect(deploy).toHaveLength(1)
    for (const l of [...install, ...deploy]) expect(l).not.toMatch(/NODE_ENV/)
    for (const name of ["base", "build"]) {
      expect(stages[name]?.length).toBeGreaterThan(0)
      expect(stages[name].filter((l) => /^(ENV|ARG)\s/i.test(l) && /NODE_ENV/.test(l))).toEqual([])
    }
  })

  it("Dockerfile: placeholder ของ guard อยู่ในบรรทัด build (ข้อความมีคำ placeholder) และไม่มีตัวแปรปิด guard ของ provider ทดสอบ", () => {
    const value = (name: string) => new RegExp(`(?:^|\\s)${name}=(\\S+)`).exec(buildRun ?? "")?.[1]
    for (const name of ["AFFILIATE_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
      expect(value(name)).toContain(PLACEHOLDER)
    }
    expect(value("STOREFRONT_URL")).toMatch(new RegExp(`^http://[^/\\s]*${PLACEHOLDER}[^/\\s]*\\.invalid/?$`))
    expect(value("EVOUCHER_ENCRYPTION_KEY")).toMatch(/^[0-9a-f]{64}$/)
    // AC-42a(1): ทั้งไฟล์ (รวม comment) ไม่มีชื่อตัวแปรนี้ — มีเฉพาะใน CI (ADR-010 ข้อ 4)
    expect(dockerfile).not.toMatch(/ALLOW_TEST_PROVIDERS/)
  })

  it("Dockerfile stage runtime: ENV NODE_ENV=production และไม่มีคำ placeholder", () => {
    expect(stages.runtime).toContain("ENV NODE_ENV=production")
    expect(stages.runtime.join("\n")).not.toContain(PLACEHOLDER)
  })

  it("ci.yml storefront-e2e: build backend ด้วย NODE_ENV=production เฉพาะบรรทัดนั้น (job env ไม่มี NODE_ENV) แล้วตรวจ bundle ก่อน medusa start", () => {
    const job = jobs["storefront-e2e"] as Job & { env?: Record<string, string> }
    expect(job.env ?? {}).not.toHaveProperty("NODE_ENV")
    const step = stepsOf("storefront-e2e").find((s) => /pnpm --filter backend build/.test(s.run ?? ""))
    const lines = (step?.run ?? "").split("\n").map((l) => l.trim())
    const build = lines.findIndex((l) => /pnpm --filter backend build/.test(l))
    expect(lines[build]).toMatch(/^NODE_ENV=production pnpm --filter backend build/)
    const check = lines.findIndex((l) => /Development Mode/.test(l))
    const start = lines.findIndex((l) => /medusa start/.test(l))
    expect(check).toBeGreaterThan(build)
    expect(start).toBeGreaterThan(check)
  })

  it("ci.yml docker-worker-mode: ตรวจ image ว่า admin ไม่มี Development Mode และไม่มีคำ placeholder (หลัง build image)", () => {
    const steps = stepsOf("docker-worker-mode")
    const worker = runIndex(steps, "tools/ops/smoke-worker-mode.sh")
    const idx = steps.findIndex((s) => /Development Mode/.test(s.run ?? "") && (s.run ?? "").includes(PLACEHOLDER))
    expect(idx).toBeGreaterThan(worker)
    expectUnconditional(steps[idx])
  })

  it("CLAUDE.md: คำสั่ง prod-like build ด้วย NODE_ENV=production", () => {
    const claude = readFileSync(path.join(REPO_DIR, "CLAUDE.md"), "utf8")
    const lines = claude.split("\n").filter((l) => /# prod-like/.test(l))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/NODE_ENV=production pnpm --filter backend build/)
  })
})

// OPS-28 (AC-43b): ขั้นตรวจ "ต้องไม่พบ" ต้อง fail-closed — `if grep …` ถือ grep error (rc ≥ 2) เป็น "ไม่พบ" แล้วผ่านเงียบ
// จึงใช้ tools/ci/assert-absent.sh (ผ่านเฉพาะ rc 1) ทั้ง 3 จุด และขั้นนับของ OPS-15 ล้มเมื่อไม่มี log
describe("OPS-28 ขั้นตรวจใน ci.yml ล้มเมื่อ grep error (fail-closed)", () => {
  const PLACEHOLDER = ["build", "only"].join("-")
  const callsAssertAbsent = (run: string | undefined, text: string) =>
    (run ?? "").split("\n").some((l) => /assert-absent\.sh\b/.test(l) && l.includes(`"${text}"`))

  it("ไม่มี run ใดในทุก job ที่ใช้รูป `if grep` / `if ! grep`", () => {
    const runs = Object.values(jobs).flatMap((job) => [
      ...(job.steps ?? []).map((s) => s.run ?? ""),
      ...matrixRuns(job),
    ])
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.filter((r) => /\bif\s+!?\s*grep\b/.test(r))).toEqual([])
  })

  it("docker-worker-mode: step ตรวจ image mount tools/ci แบบ read-only แล้วเรียก assert-absent.sh กับ Development Mode และคำ placeholder", () => {
    const step = stepsOf("docker-worker-mode").find((s) => /medusa-ecom-backend:local/.test(s.run ?? ""))
    expect(step?.run).toMatch(/-v\s+"?\$(PWD|\{?GITHUB_WORKSPACE\}?)\/tools\/ci:\/ci:ro"?/)
    expect(callsAssertAbsent(step?.run, "Development Mode")).toBe(true)
    expect(callsAssertAbsent(step?.run, PLACEHOLDER)).toBe(true)
    expectUnconditional(step)
  })

  it("storefront-e2e: เรียก assert-absent.sh กับ Development Mode หลังบรรทัด build และก่อน medusa start", () => {
    const step = stepsOf("storefront-e2e").find((s) => /pnpm --filter backend build/.test(s.run ?? ""))
    const lines = (step?.run ?? "").split("\n")
    const build = lines.findIndex((l) => /pnpm --filter backend build/.test(l))
    const check = lines.findIndex((l) => callsAssertAbsent(l, "Development Mode"))
    const start = lines.findIndex((l) => /medusa start/.test(l))
    expect(build).toBeGreaterThanOrEqual(0)
    expect(check).toBeGreaterThan(build)
    expect(start).toBeGreaterThan(check)
  })

  it("OPS-15: ขั้นนับไม่ใช้ `|| true` และตรวจว่ามีไฟล์ $TEST_LOG ก่อนนับ", () => {
    const run = stepsOf("backend-suites").find((s) => /OPS-15/.test(s.name ?? ""))?.run ?? ""
    expect(run).not.toMatch(/\|\|\s*true/)
    const exists = run.search(/\[\s+(!\s+)?-[efrs]\s+"\$TEST_LOG"\s+\]/)
    expect(exists).toBeGreaterThanOrEqual(0)
    expect(exists).toBeLessThan(run.search(/grep -c/))
  })

  it("lint-typecheck: รัน tools/ci/assert-absent.test.sh", () => {
    expect(runIndex(stepsOf("lint-typecheck"), "tools/ci/assert-absent.test.sh")).toBeGreaterThanOrEqual(0)
  })

  // nit review #403: รันเนื้อ step จริงด้วย shell default ของ Actions (`bash -e`) — grep error (rc ≥ 2) ต้องล้ม ไม่นับเป็น 0
  it("OPS-15: เนื้อ step ล้มเมื่อ grep คืน rc ≥ 2 หรือไม่มี log; log ว่างผ่าน; พบข้อความล้ม", () => {
    const step = stepsOf("backend-suites").find((s) => /OPS-15/.test(s.name ?? ""))
    expect(step?.shell).toBeUndefined()
    const tmp = mkdtempSync(path.join(os.tmpdir(), "ops29-ops15-"))
    const runWith = (testLog: string) => {
      const r = spawnSync("bash", ["-e", "-c", step?.run ?? "exit 1"], {
        env: { ...process.env, TEST_LOG: testLog },
        encoding: "utf8",
      })
      return { status: r.status, out: `${r.stdout}${r.stderr}` }
    }
    try {
      const dir = path.join(tmp, "dir.log")
      mkdirSync(dir) // grep -c กับ directory → rc 2
      const empty = path.join(tmp, "empty.log")
      writeFileSync(empty, "PASS a.spec.ts\n")
      const bad = path.join(tmp, "bad.log")
      // ข้อความที่นับอ่านจาก step (ห้ามเขียนตรงในโค้ด — test OPS-15 ตรวจว่ามีเฉพาะใน ci.yml)
      const counted = /grep -c "([^"]+)"/.exec(step?.run ?? "")?.[1]
      expect(counted).toBeDefined()
      writeFileSync(bad, `${counted}\n`)

      const grepError = runWith(dir)
      expect(grepError.status).not.toBe(0)
      expect(grepError.out).toContain("::error::")
      const missing = runWith(path.join(tmp, "missing.log"))
      expect(missing.status).not.toBe(0)
      expect(missing.out).toContain("::error::")
      expect(runWith(empty).status).toBe(0)
      expect(runWith(bad).status).not.toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

// OPS-29 (AC-44a): Compiler ของ Medusa ไม่ข้าม `__tests__` → ไฟล์ test ถูก compile ลง .medusa/server แล้วเข้า image
// แก้ที่ build context (.dockerignore) ไม่แตะ tsconfig.json (typecheck ใช้ร่วม) และ CI ตรวจ image แบบ fail-closed
describe("OPS-29 image ไม่มีไฟล์ test ที่ compile แล้ว", () => {
  const dockerignore = readFileSync(path.join(REPO_DIR, ".dockerignore"), "utf8")
    .split("\n")
    .map((l) => l.trim())
  const imageStep = () => stepsOf("docker-worker-mode").find((s) => /medusa-ecom-backend:local/.test(s.run ?? ""))

  it(".dockerignore ตัด __tests__ ใต้ apps/backend/src และ apps/backend/integration-tests ออกจาก build context", () => {
    expect(dockerignore).toContain("apps/backend/src/**/__tests__")
    expect(dockerignore).toContain("apps/backend/integration-tests")
  })

  it("tsconfig.json ของ backend: exclude ไม่มี __tests__/spec (typecheck ยังตรวจไฟล์ test)", () => {
    const tsconfig = readFileSync(path.join(BACKEND_DIR, "tsconfig.json"), "utf8")
    const exclude = /"exclude"\s*:\s*\[([^\]]*)\]/.exec(tsconfig)?.[1]
    expect(exclude).toBeDefined()
    expect(exclude).toMatch(/node_modules/)
    expect(exclude).not.toMatch(/__tests__|spec/)
  })

  it("docker-worker-mode: step ตรวจ image ตรวจ __tests__/*.spec.js ใน /app (ยกเว้น node_modules) และยืนยันว่า /app/src/api, /app/src/modules มีอยู่", () => {
    const run = imageStep()?.run ?? ""
    expect(run).toMatch(/find \/app\b[^\n]*-path \/app\/node_modules -prune/)
    expect(run).toMatch(/-name __tests__/)
    expect(run).toMatch(/-name "\*\.spec\.js"/)
    expect(run).toMatch(/test -d \/app\/src\/api\b/)
    expect(run).toMatch(/test -d \/app\/src\/modules\b/)
    // fail-closed: ผล find เก็บด้วย command substitution ตรงๆ (set -e ล้มเมื่อ find error) ไม่ผ่าน pipe ที่กลืน exit code
    expect(run).toMatch(/set -eu/)
    expect(run).toMatch(/=\$\(find \/app\b[^)|]*\)/)
    expectUnconditional(imageStep())
  })
})
