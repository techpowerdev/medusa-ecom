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

function runStopped(env: Record<string, string>, plant: Record<string, string> = {}): Run {
  const bin = mkdtempSync(path.join(tmpdir(), "ops17-bin-"))
  const record = path.join(bin, "image-tag.txt")
  writeFileSync(path.join(bin, "docker"), `#!/bin/sh\nprintf '%s' "\${IMAGE_TAG-<unset>}" > "${record}"\nexit 1\n`)
  chmodSync(path.join(bin, "docker"), 0o755)
  // OUT ต้องเป็น path relative กับ cwd (run.sh ใช้ $(pwd)/$LOAD_OUT) — อยู่ใต้ tools/load/out ที่ gitignore แล้ว
  const outRel = `tools/load/out/unit-ops17-${process.pid}-${Date.now()}`
  const outDir = path.join(ROOT, outRel)
  mkdirSync(outDir, { recursive: true })
  for (const [name, text] of Object.entries(plant)) {
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
  it("พิมพ์ report ที่มีลง job log, ตรวจ OUT แล้วลบไฟล์ที่มี JWT/setup_data และคง exit code เดิม (≠ 0)", () => {
    const r = runStopped(
      {},
      {
        "report.md": "## OPS-4 load test\n\nfailures: 1\n",
        "lock-timing.md": "## OPS-18 เวลา lock\n",
        "leak.log": `Authorization: Bearer ${fakeJwt()}\n`,
        "summary.json": JSON.stringify({ setup_data: { checkout: [] } }),
        "clean.json": JSON.stringify({ metrics: {} }),
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
      expect(`${r.stdout}${r.stderr}`).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./)
    } finally {
      rmSync(r.outDir, { recursive: true, force: true })
    }
  })

  it("ใน cleanup() พิมพ์ report ก่อน scan (ไฟล์ที่ scan ลบยังเห็นใน job log) และ scan ไม่ทำให้ cleanup ล้ม", () => {
    const runner = read("tools/load/run.sh")
    const body = /^cleanup\(\) \{\n([\s\S]*?)^\}/m.exec(runner)?.[1] ?? ""
    const cat = body.indexOf("cat ")
    const scan = body.indexOf('node tools/load/artifact-guard.js scan "$OUT"')
    expect(cat).toBeGreaterThan(-1)
    expect(scan).toBeGreaterThan(cat)
    expect(body).toMatch(/artifact-guard\.js scan "\$OUT"[^\n]*\|\| true/)
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
