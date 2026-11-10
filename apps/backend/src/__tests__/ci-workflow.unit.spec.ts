import { execFileSync } from "child_process"
import { mkdtempSync, readFileSync, rmSync } from "fs"
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
