import { spawnSync } from "child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { createRequire } from "module"
import { tmpdir } from "os"
import path from "path"

// OPS-17a (spec 07 AC-33): artifact ของ load run (OUT) ไม่มี `setup_data` และไม่มีสตริงรูปแบบ JWT
// — summary ของ k6 (--summary-export) มี setup_data.checkout[].token ของลูกค้า load test มาตั้งแต่ OPS-4
const ROOT = path.resolve(__dirname, "../../../..")
const GUARD = path.join(ROOT, "tools/load/artifact-guard.js")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

const guard = createRequire(__filename)(GUARD) as {
  stripSetupData: (summary: Record<string, unknown>) => Record<string, unknown>
  findLeaks: (dir: string) => string[]
}

// JWT ปลอมสร้างตอนรัน (ไม่มี literal รูปแบบ JWT ใน repo)
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
const fakeJwt = () => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ actor_id: "cus_1" })}.c2lnbmF0dXJl`
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./

const summaryFixture = () => ({
  root_group: { name: "", path: "", id: "x", groups: [], checks: [] },
  metrics: {
    checkout_sold_out: { count: 200, rate: 3.3 },
    http_5xx: { count: 0, rate: 0, thresholds: { "count==0": false } },
    "http_req_duration{scenario:checkout}": { "p(95)": 1234.5, max: 2000 },
  },
  setup_data: {
    checkout: [{ cart_id: "cart_1", token: fakeJwt() }],
    burst: [{ cart_id: "cart_2", token: fakeJwt() }],
  },
})

let dir: string
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ops-17a-"))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe("OPS-17a stripSetupData", () => {
  it("summary ที่มี setup_data.checkout[].token → ผลไม่มี setup_data/JWT และ metric เดิมครบ", () => {
    const input = summaryFixture()
    const out = guard.stripSetupData(input)
    expect(out).not.toHaveProperty("setup_data")
    expect(JSON.stringify(out)).not.toMatch(JWT_RE)
    expect(out.metrics).toEqual(input.metrics)
    expect(out.root_group).toEqual(input.root_group)
  })

  it("CLI strip: อ่าน summary ดิบแล้วเขียนไฟล์ที่ไม่มี setup_data", () => {
    const raw = path.join(dir, "raw.json")
    const dest = path.join(dir, "flash-sale.json")
    writeFileSync(raw, JSON.stringify(summaryFixture()))
    const r = spawnSync(process.execPath, [GUARD, "strip", raw, dest], { encoding: "utf8" })
    expect(r.status).toBe(0)
    const written = readFileSync(dest, "utf8")
    expect(JSON.parse(written)).not.toHaveProperty("setup_data")
    expect(written).not.toMatch(JWT_RE)
    expect(JSON.parse(written).metrics.checkout_sold_out.count).toBe(200)
  })
})

describe("OPS-17a findLeaks / CLI scan", () => {
  it("ไฟล์ไม่มี JWT/setup_data → ไม่พบ และ scan exit 0", () => {
    writeFileSync(path.join(dir, "report.md"), "failures: 0\n")
    writeFileSync(path.join(dir, "flash-sale.json"), JSON.stringify(guard.stripSetupData(summaryFixture())))
    expect(guard.findLeaks(dir)).toEqual([])
    expect(spawnSync(process.execPath, [GUARD, "scan", dir], { encoding: "utf8" }).status).toBe(0)
  })

  it("ไฟล์มี JWT (รวมในโฟลเดอร์ย่อย) หรือ key setup_data → พบ และ scan ล้ม (exit ≠ 0) ลบไฟล์นั้นและไม่พิมพ์ token", () => {
    const token = fakeJwt()
    writeFileSync(path.join(dir, "report.md"), "failures: 0\n")
    writeFileSync(path.join(dir, "backend-tail.log"), `authorization: Bearer ${token}\n`)
    writeFileSync(path.join(dir, "flash-sale.json"), JSON.stringify({ metrics: {}, setup_data: { checkout: [] } }))
    mkdirSync(path.join(dir, "sub"))
    writeFileSync(path.join(dir, "sub", "x.txt"), token)

    expect(guard.findLeaks(dir).sort()).toEqual(["backend-tail.log", "flash-sale.json", path.join("sub", "x.txt")].sort())

    const r = spawnSync(process.execPath, [GUARD, "scan", dir], { encoding: "utf8" })
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).not.toContain(token)
    expect(r.stderr).toContain("backend-tail.log")
    expect(existsSync(path.join(dir, "backend-tail.log"))).toBe(false)
    expect(existsSync(path.join(dir, "flash-sale.json"))).toBe(false)
    expect(existsSync(path.join(dir, "report.md"))).toBe(true)
  })
})

describe("OPS-17a run.sh", () => {
  const runner = read("tools/load/run.sh")

  it("k6 เขียน summary ดิบนอก OUT แล้ว strip ก่อนเขียนลง OUT", () => {
    expect(runner).toMatch(/--summary-export "\/k6\/\$1\.json"/)
    expect(runner).not.toMatch(/--summary-export "\/out\//)
    expect(runner).toMatch(/node tools\/load\/artifact-guard\.js strip "\$DATA\/k6\/\$1\.json" "\$OUT\/\$1\.json"/)
  })

  it("ขั้นตรวจ JWT ใน OUT อยู่หลังไฟล์สุดท้ายที่เขียนลง OUT และก่อนตัดสินผ่าน/ไม่ผ่าน", () => {
    // ตัวท้าย script (cleanup() ก็เรียก scan ด้วย — OPS-17)
    const scan = runner.lastIndexOf('node tools/load/artifact-guard.js scan "$OUT" ||')
    expect(scan).toBeGreaterThan(-1)
    expect(scan).toBeGreaterThan(runner.lastIndexOf("backend-tail.log"))
    expect(scan).toBeGreaterThan(runner.lastIndexOf('>"$OUT/report.md"'))
    expect(scan).toBeLessThan(runner.lastIndexOf('echo "load test: ผ่าน"'))
  })
})
