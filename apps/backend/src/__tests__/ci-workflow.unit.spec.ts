import { execFileSync } from "child_process"
import { readFileSync } from "fs"
import path from "path"

// OPS-14: ลดเวลา CI ต่อ PR — storefront-e2e รันขนานกับ backend, integration:http แบ่ง shard,
// job `backend-tests` คงไว้เป็นตัวรวมผล และ shard ทุกตัวรวมกันต้องรัน test ครบเท่าเดิม
const BACKEND_DIR = path.resolve(__dirname, "../..")
const JEST_BIN = require.resolve("jest/bin/jest")
const yml = readFileSync(path.join(BACKEND_DIR, "../../.github/workflows/ci.yml"), "utf8")

/** เนื้อหาของแต่ละ job (บรรทัดใต้ `  <id>:` จนถึง job ถัดไป) */
function jobBodies(): Record<string, string> {
  const lines = yml.split(/\r?\n/)
  const out: Record<string, string> = {}
  let current: string | null = null
  for (const line of lines.slice(lines.indexOf("jobs:") + 1)) {
    const job = /^ {2}([\w-]+):\s*$/.exec(line)
    if (job) {
      current = job[1]
      out[current] = ""
    } else if (current) {
      out[current] += `${line}\n`
    }
  }
  return out
}

function needsOf(body: string): string[] {
  const m = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(body)
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : []
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

const jobs = jobBodies()

describe("OPS-14 ci.yml", () => {
  it("storefront-e2e ไม่รอ job ของ backend tests (รันขนาน)", () => {
    const needs = needsOf(jobs["storefront-e2e"])
    expect(needs).toEqual(expect.arrayContaining(["changes", "lint-typecheck"]))
    expect(needs.filter((n) => /^backend/.test(n))).toEqual([])
  })

  it("integration:http แบ่ง shard ใน matrix และ shard รวมกันครบทุกไฟล์ไม่ซ้ำ", () => {
    const shards = [...yml.matchAll(/test:integration:http --shard=(\d+)\/(\d+)/g)]
    expect(shards.length).toBeGreaterThan(1)
    const total = Number(shards[0][2])
    expect(shards.map((s) => Number(s[2]))).toEqual(shards.map(() => total))
    expect(shards.map((s) => Number(s[1])).sort()).toEqual(Array.from({ length: total }, (_, i) => i + 1))

    const union = shards.flatMap((s) => listTests("integration:http", `${s[1]}/${s[2]}`)).sort()
    expect(union).toEqual(listTests("integration:http"))
  })

  it("ยังรัน test:unit และ test:integration:modules ใน CI", () => {
    expect(yml).toMatch(/pnpm --filter backend test:unit\b/)
    expect(yml).toMatch(/pnpm --filter backend test:integration:modules\b/)
  })

  it("job backend-tests เป็นตัวรวมผลที่รอทุก shard และ fail เมื่อ shard ไม่ success", () => {
    const body = jobs["backend-tests"]
    expect(body).toBeDefined()
    const shardJobs = Object.keys(jobs).filter((id) => /test:integration:http --shard/.test(jobs[id]))
    expect(shardJobs.length).toBeGreaterThan(0)
    expect(needsOf(body)).toEqual(expect.arrayContaining([...shardJobs, "changes"]))
    // !cancelled(): ไม่ถูกข้ามเงียบเมื่อ shard ล้ม แต่ยังเป็น SKIPPED เมื่อ classify-changes ตัดสิน backend=false
    expect(body).toMatch(/if:.*!cancelled\(\).*needs\.changes\.outputs\.backend == 'true'/s)
    expect(body).toMatch(/exit 1/)
  })
})

// OPS-15 (AC-26): job integration ของ backend เก็บ log ของ test แล้วนับบรรทัด error ของ knex
// ที่เกิดจาก connection ถูก terminate — fail เมื่อ > 0 (แก้ที่ต้นเหตุ ไม่กรอง/ปิด log)
describe("OPS-15 ci.yml นับ log connection ของ knex", () => {
  const body = jobs["backend-suites"]
  const countStep = /- name: [^\n]*OPS-15[^\n]*\n([\s\S]*?)(?=\n {6}- |\n*$)/.exec(body)?.[1] ?? ""
  const pattern = /grep -c "([^"]+)"/.exec(countStep)?.[1]

  it("ขั้นรัน test เขียน log ลงไฟล์ (shell: bash = -eo pipefail คง exit code ของ jest)", () => {
    expect(body).toMatch(/- shell: bash\n\s+env:\n\s+TEST_LOG:/)
    expect(body).toMatch(/\{ \$\{\{ matrix\.run \}\}; \} 2>&1 \| tee "?\$TEST_LOG"?/)
  })

  it("มีขั้นนับที่รันแม้ test ล้ม และ exit 1 เมื่อจำนวน > 0", () => {
    expect(countStep).toMatch(/if: \$\{\{ !cancelled\(\) \}\}/)
    expect(pattern).toMatch(/ended unexpectedly/)
    expect(countStep).toMatch(/-gt 0/)
    expect(countStep).toMatch(/exit 1/)
  })

  it("สตริงที่นับไม่อยู่ในโค้ดส่วนอื่น (ไม่แก้ด้วยการกรอง/ปิด log)", () => {
    const repo = path.resolve(BACKEND_DIR, "../..")
    const out = execFileSync("git", ["grep", "-l", "-F", pattern ?? "", "--", ".", ":!docs"], {
      cwd: repo,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
    expect(out).toEqual([".github/workflows/ci.yml"])
  })
})
