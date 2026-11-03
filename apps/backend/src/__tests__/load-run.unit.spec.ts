import { spawnSync } from "child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import path from "path"

// OPS-17 (spec 07 AC-28): tools/load/run.sh ใช้ image tag ของ load test เอง (ไม่ทับ image `local` ของ dev)
// + follow-up review #220 (OPS-17a, AC-33): cleanup() พิมพ์ report ลง job log แล้วตรวจ JWT ใน OUT แม้ script หยุดกลางทาง
// รัน run.sh จริงโดยแทน `docker` ด้วย stub ที่บันทึก IMAGE_TAG แล้วล้ม → script หยุดที่ `compose up` (ไม่บูต stack จริง)
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
const fakeJwt = () => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ actor_id: "cus_1" })}.c2lnbmF0dXJl`

type Run = { status: number | null; stdout: string; stderr: string; imageTag: string; outDir: string }
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
  // OUT ต้องเป็น path relative กับ cwd (run.sh ใช้ $(pwd)/$LOAD_OUT) — อยู่ใต้ tools/load/out ที่ gitignore แล้ว
  const outRel = `tools/load/out/unit-ops17-${process.pid}-${Date.now()}`
  const outDir = path.join(ROOT, outRel)
  writeFileSync(
    path.join(bin, "docker"),
    `#!/bin/sh\nprintf '%s' "\${IMAGE_TAG-<unset>}" > "${record}"\ncase " $* " in *" up "*) cp -R "${staging}/." "${outDir}/" ;; esac\nexit 1\n`
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
  rmSync(bin, { recursive: true, force: true })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, imageTag, outDir }
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
