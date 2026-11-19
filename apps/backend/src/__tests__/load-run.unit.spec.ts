import { spawnSync } from "child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { parse } from "yaml"

// OPS-17 (spec 07 AC-28): tools/load/run.sh ใช้ image tag ของ load test เอง (ไม่ทับ image `local` ของ dev)
// + follow-up review #220 (OPS-17a, AC-33): cleanup() พิมพ์ report ลง job log แล้วตรวจ JWT ใน OUT แม้ script หยุดกลางทาง
// รัน run.sh จริงโดยแทน `docker` ด้วย stub ที่บันทึก IMAGE_TAG แล้วล้ม → script หยุดที่ `compose up` (ไม่บูต stack จริง)
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
const fakeJwt = () => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ actor_id: "cus_1" })}.c2lnbmF0dXJl`

type Run = {
  status: number | null
  stdout: string
  stderr: string
  imageTag: string
  poolMax: string
  outDir: string
  /** OPS-26: argument ของ `docker` ตอน `compose up` + env ที่ compose ได้รับ (ไม่เรียก docker = "<docker-not-called>") */
  upArgs: string
  poolMin: string
  serverProcesses: string
}
type Files = Record<string, string>

/**
 * รัน run.sh โดย `docker` เป็น stub: บันทึก IMAGE_TAG, คัดลอก `written` ลง OUT ตอน `compose up` (จำลองไฟล์ที่ run เขียนก่อนหยุด — ไม่คัดลอกซ้ำตอน `compose down`) แล้ว exit 1
 * → script หยุดที่ `compose up` (set -e) และ cleanup() ทำงาน; `stale` = ไฟล์ใน OUT จาก run ก่อน (มีอยู่ก่อนเริ่ม)
 */
function runStopped(env: Record<string, string>, { stale = {}, written = {} }: { stale?: Files; written?: Files } = {}): Run {
  const bin = mkdtempSync(path.join(tmpdir(), "ops17-bin-"))
  const staging = path.join(bin, "written")
  mkdirSync(staging)
  for (const [name, text] of Object.entries(written)) {
    writeFileSync(path.join(staging, name), text)
  }
  const record = path.join(bin, "image-tag.txt")
  const poolRecord = path.join(bin, "pool-max.txt") // OPS-23: DATABASE_POOL_MAX ที่ compose ได้รับ
  const upRecord = path.join(bin, "up.txt") // OPS-26: argument ของ compose up / DATABASE_POOL_MIN / LOAD_SERVER_PROCESSES
  // OUT ต้องเป็น path relative กับ cwd (run.sh ใช้ $(pwd)/$LOAD_OUT) — อยู่ใต้ tools/load/out ที่ gitignore แล้ว
  const outRel = `tools/load/out/unit-ops17-${process.pid}-${Date.now()}`
  const outDir = path.join(ROOT, outRel)
  writeFileSync(
    path.join(bin, "docker"),
    `#!/bin/sh\nprintf '%s' "\${IMAGE_TAG-<unset>}" > "${record}"\nprintf '%s' "\${DATABASE_POOL_MAX-<unset>}" > "${poolRecord}"\ncase " $* " in *" up "*) cp -R "${staging}/." "${outDir}/"; printf '%s\\n%s\\n%s' "$*" "\${DATABASE_POOL_MIN-<unset>}" "\${LOAD_SERVER_PROCESSES-<unset>}" > "${upRecord}" ;; esac\nexit 1\n`
  )
  chmodSync(path.join(bin, "docker"), 0o755)
  mkdirSync(outDir, { recursive: true })
  for (const [name, text] of Object.entries(stale)) {
    writeFileSync(path.join(outDir, name), text)
  }
  const { IMAGE_TAG: _omit, ...base } = process.env
  const r = spawnSync("bash", ["tools/load/run.sh"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...base, PATH: `${bin}:${process.env.PATH}`, LOAD_OUT: outRel, LOAD_PROJECT: "loadtest-unit-ops17", ...env },
  })
  const imageTag = existsSync(record) ? readFileSync(record, "utf8") : ""
  const poolMax = existsSync(poolRecord) ? readFileSync(poolRecord, "utf8") : "<docker-not-called>"
  const [upArgs, poolMin, serverProcesses] = existsSync(upRecord)
    ? readFileSync(upRecord, "utf8").split("\n")
    : ["<docker-not-called>", "<docker-not-called>", "<docker-not-called>"]
  rmSync(bin, { recursive: true, force: true })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, imageTag, poolMax, outDir, upArgs, poolMin, serverProcesses }
}

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./

describe("OPS-17 AC-28 run.sh IMAGE_TAG", () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

  it("ไม่ส่ง IMAGE_TAG → compose ได้ IMAGE_TAG=load (ไม่ใช่ local ของ dev)", () => {
    const r = runStopped({})
    dirs.push(r.outDir)
    expect(r.imageTag).toBe("load")
  })

  it("ส่ง IMAGE_TAG มา → ใช้ค่าที่ส่ง", () => {
    const r = runStopped({ IMAGE_TAG: "ci-123" })
    dirs.push(r.outDir)
    expect(r.imageTag).toBe("ci-123")
  })
})

// OPS-23 (spec 07 AC-38): เทียบ DATABASE_POOL_MAX ใน load-nightly — run.sh ส่ง LOAD_DB_POOL_MAX เป็น DATABASE_POOL_MAX ให้ compose
// ไม่ส่ง = ว่าง (default ของ Medusa; ไม่รับค่าที่ค้างใน shell เหมือน DATABASE_URL) และค่าที่ไม่ใช่จำนวนเต็มบวกหยุดก่อนเรียก docker
describe("OPS-23 AC-38 run.sh LOAD_DB_POOL_MAX → DATABASE_POOL_MAX", () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

  it.each(["10", "20", "40"])("LOAD_DB_POOL_MAX=%s → compose ได้ DATABASE_POOL_MAX เดียวกัน", (v) => {
    const r = runStopped({ LOAD_DB_POOL_MAX: v })
    dirs.push(r.outDir)
    expect(r.poolMax).toBe(v)
  })

  it("ไม่ส่ง LOAD_DB_POOL_MAX → DATABASE_POOL_MAX ว่าง (default ของ Medusa) แม้ shell มีค่าค้าง", () => {
    const r = runStopped({ DATABASE_POOL_MAX: "99" })
    dirs.push(r.outDir)
    expect(r.poolMax).toBe("")
  })

  it.each(["abc", "0", "-5", "20; rm -rf /", "1.5"])("LOAD_DB_POOL_MAX=%j → exit 2 ก่อนเรียก docker", (v) => {
    const r = runStopped({ LOAD_DB_POOL_MAX: v })
    dirs.push(r.outDir)
    expect(r.status).toBe(2)
    expect(r.stderr).toContain("LOAD_DB_POOL_MAX")
    expect(r.poolMax).toBe("<docker-not-called>")
  })

  it("report.md บันทึกค่า pool ของ run (เทียบ run ได้จาก artifact)", () => {
    const runner = read("tools/load/run.sh")
    const report = runner.slice(runner.indexOf("## OPS-4 load test"), runner.indexOf('} >"$OUT/report.md"'))
    expect(report).toContain("DATABASE_POOL_MAX=")
  })
})

// OPS-26 (spec 07 AC-41): เทียบ server 1 vs 2 process — n > 1 เพิ่ม override ให้ container server รัน
// `start --cluster <n> --servers <n>` (ทุก process คง MEDUSA_WORKER_MODE=server); n = 1/ว่าง = คำสั่ง compose เดิมทุกตัวอักษร
describe("OPS-26 AC-41 run.sh LOAD_SERVER_PROCESSES", () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))
  const ORIGINAL_UP = "compose -p loadtest-unit-ops17 -f docker-compose.prod.yml up -d --build --wait server worker"

  it.each<Record<string, string>>([{}, { LOAD_SERVER_PROCESSES: "" }, { LOAD_SERVER_PROCESSES: "1" }])("%j → compose up เดิมทุกตัวอักษร (ไม่มี --cluster)", (env) => {
    const r = runStopped(env)
    dirs.push(r.outDir)
    expect(r.upArgs).toBe(ORIGINAL_UP)
    expect(r.upArgs).not.toContain("cluster")
  })

  it("LOAD_SERVER_PROCESSES=2 → เพิ่ม override ของ server และส่ง n ให้ compose", () => {
    const r = runStopped({ LOAD_SERVER_PROCESSES: "2" })
    dirs.push(r.outDir)
    expect(r.upArgs).toBe(
      "compose -p loadtest-unit-ops17 -f docker-compose.prod.yml -f tools/load/server-cluster.yml up -d --build --wait server worker"
    )
    expect(r.serverProcesses).toBe("2")
  })

  it("override แตะเฉพาะ command ของ server: start --cluster n --servers n (ไม่ใช้กับ worker)", () => {
    const override = parse(read("tools/load/server-cluster.yml")) as { services: Record<string, { command?: string[] }> }
    expect(Object.keys(override.services)).toEqual(["server"])
    expect(override.services.server).toEqual({
      command: ["start", "--cluster", "${LOAD_SERVER_PROCESSES}", "--servers", "${LOAD_SERVER_PROCESSES}"],
    })
  })

  it.each(["0", "abc", "-1", "2; rm -rf /", "1.5"])("LOAD_SERVER_PROCESSES=%j → exit 2 ก่อนเรียก docker", (v) => {
    const r = runStopped({ LOAD_SERVER_PROCESSES: v })
    dirs.push(r.outDir)
    expect(r.status).toBe(2)
    expect(r.stderr).toContain("LOAD_SERVER_PROCESSES")
    expect(r.upArgs).toBe("<docker-not-called>")
  })

  it("report.md บันทึกจำนวน process ที่สั่งและที่บูตจริง (นับจาก log ของ server)", () => {
    const runner = read("tools/load/run.sh")
    const report = runner.slice(runner.indexOf("## OPS-4 load test"), runner.indexOf('} >"$OUT/report.md"'))
    expect(report).toContain("server processes (OPS-26): ")
    expect(runner).toMatch(/compose logs[^\n]*server[^\n]*\| grep -c "Server is ready on port"/)
  })

  it("review #371: DATABASE_POOL_MIN ที่ค้างใน shell ไม่ถึง compose (ว่าง = default ของ Medusa)", () => {
    const r = runStopped({ DATABASE_POOL_MIN: "7" })
    dirs.push(r.outDir)
    expect(r.poolMin).toBe("<unset>")
  })
})

describe("OPS-17 (review #220) cleanup() ของ run.sh เมื่อ script หยุดกลางทาง", () => {
  it("ตรวจ OUT แล้วลบไฟล์ที่มี JWT/setup_data, พิมพ์ report ที่เหลือลง job log และคง exit code เดิม (≠ 0)", () => {
    const r = runStopped(
      {},
      {
        written: {
          "report.md": "## OPS-4 load test\n\nfailures: 1\n",
          "lock-timing.md": "## OPS-18 เวลา lock\n",
          "leak.log": `Authorization: Bearer ${fakeJwt()}\n`,
          "summary.json": JSON.stringify({ setup_data: { checkout: [] } }),
          "clean.json": JSON.stringify({ metrics: {} }),
        },
      }
    )
    try {
      expect(r.status).not.toBe(0)
      expect(r.stdout).toContain("failures: 1")
      expect(r.stdout).toContain("## OPS-18 เวลา lock")
      expect(existsSync(path.join(r.outDir, "leak.log"))).toBe(false)
      expect(existsSync(path.join(r.outDir, "summary.json"))).toBe(false)
      expect(existsSync(path.join(r.outDir, "clean.json"))).toBe(true)
      expect(r.stderr).toContain("AC-33")
      expect(`${r.stdout}${r.stderr}`).not.toMatch(JWT_RE)
    } finally {
      rmSync(r.outDir, { recursive: true, force: true })
    }
  })

  it("review #235: report.md มี JWT → scan ลบก่อนพิมพ์ JWT ไม่หลุดลง job log (stdout/stderr)", () => {
    const r = runStopped(
      {},
      { written: { "report.md": `failures: 1\nAuthorization: Bearer ${fakeJwt()}\n`, "lock-timing.md": "## OPS-18 เวลา lock\n" } }
    )
    try {
      expect(r.status).not.toBe(0)
      expect(`${r.stdout}${r.stderr}`).not.toMatch(JWT_RE)
      expect(existsSync(path.join(r.outDir, "report.md"))).toBe(false)
      expect(r.stdout).toContain("## OPS-18 เวลา lock")
    } finally {
      rmSync(r.outDir, { recursive: true, force: true })
    }
  })

  it("review #235 nit: report ของ run ก่อนใน OUT ถูกล้างตอนเริ่ม — cleanup ไม่พิมพ์ report เก่า", () => {
    const r = runStopped({}, { stale: { "report.md": "STALE-REPORT-OPS17\n", "checkout-timing.md": "STALE-TIMING-OPS17\n" } })
    try {
      expect(r.status).not.toBe(0)
      expect(r.stdout).not.toContain("STALE-")
      expect(existsSync(path.join(r.outDir, "report.md"))).toBe(false)
    } finally {
      rmSync(r.outDir, { recursive: true, force: true })
    }
  })

  it("scan มาก่อน cat ทั้งใน cleanup() และทางปกติ (job log/GITHUB_STEP_SUMMARY) และ scan ใน cleanup ไม่ทำให้ cleanup ล้ม", () => {
    const runner = read("tools/load/run.sh")
    const SCAN = 'node tools/load/artifact-guard.js scan "$OUT"'
    const body = /^cleanup\(\) \{\n([\s\S]*?)^\}/m.exec(runner)?.[1] ?? ""
    expect(body.indexOf(SCAN)).toBeGreaterThan(-1)
    expect(body.indexOf("cat ")).toBeGreaterThan(body.indexOf(SCAN))
    expect(body).toMatch(/artifact-guard\.js scan "\$OUT"[^\n]*\|\| true/)

    const main = runner.slice(runner.indexOf('} >"$OUT/report.md"'))
    const firstScan = main.indexOf(SCAN)
    expect(firstScan).toBeGreaterThan(-1)
    expect(main.indexOf("cat ")).toBeGreaterThan(firstScan)
    expect(main.indexOf('>>"$GITHUB_STEP_SUMMARY"')).toBeGreaterThan(firstScan)
  })
})

describe("OPS-17 AC-28 grep", () => {
  it("seed-load.ts ไม่มี cast (as unknown as / as any / as CreateGroupBuyCampaignInput)", () => {
    const src = read("apps/backend/src/scripts/seed-load.ts")
    expect(src).not.toMatch(/as unknown as|as any\b|as CreateGroupBuyCampaignInput/)
  })

  it("prod-guards.unit.spec.ts อ่าน ci.yml ด้วย parse ของ yaml ไม่วนบรรทัด (ไม่มีตัวแปรสถานะ inEnv)", () => {
    const src = read("apps/backend/src/__tests__/prod-guards.unit.spec.ts")
    expect(src).toMatch(/import \{ parse \} from "yaml"/)
    expect(src).not.toMatch(/inEnv/)
  })

  it("lock-timing.js ไม่มี indexOf (ลำดับคิวของ hold_rank_corr ใช้ Map — O(n))", () => {
    expect(read("tools/load/lock-timing.js")).not.toMatch(/indexOf/)
  })
})
