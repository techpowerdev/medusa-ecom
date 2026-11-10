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
  redact: (text: string) => string
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

// OPS-17b (spec 07 AC-34): ก่อน cat/grep เนื้อหาจาก OUT หรือ console ของ k6 ลง job log/GITHUB_STEP_SUMMARY ต้อง scan ก่อน
// (ในบล็อกเดียวกัน) หรือ pipe ผ่าน `artifact-guard.js redact`
describe("OPS-17b redact", () => {
  const { redact } = guard

  it("input ที่มี JWT → ผลไม่มีรูปแบบ JWT แทนด้วย [REDACTED_JWT] และข้อความอื่นคงเดิม", () => {
    const t1 = fakeJwt()
    const t2 = fakeJwt()
    const input = `checkout cart_1: 500 {"auth":"Bearer ${t1}"}\nไม่มี token ตรงนี้ cart_2\nx=${t2} y=1\n`
    const out = redact(input)
    expect(out).not.toMatch(JWT_RE)
    expect(out).toBe(`checkout cart_1: 500 {"auth":"Bearer [REDACTED_JWT]"}\nไม่มี token ตรงนี้ cart_2\nx=[REDACTED_JWT] y=1\n`)
    expect(redact("checkout_k6_timing cart_id=cart_1 status=200\n")).toBe("checkout_k6_timing cart_id=cart_1 status=200\n")
  })

  it("CLI redact: อ่าน stdin แล้วพิมพ์ stdout ที่ไม่มี JWT (exit 0)", () => {
    const token = fakeJwt()
    const r = spawnSync(process.execPath, [GUARD, "redact"], { input: `join cart_9: 500 ${token}\nok\n`, encoding: "utf8" })
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).not.toContain(token)
    expect(r.stdout).toBe("join cart_9: 500 [REDACTED_JWT]\nok\n")
  })
})

// คำสั่ง cat/grep (ไม่ใช่ grep -q) ที่อ่านไฟล์ใน $OUT/console ของ k6 แต่ไม่ pipe ผ่าน redact และไม่มี scan "$OUT" ก่อนหน้าในบล็อกเดียวกัน
// บล็อก = body ของ function ระดับบนสุด (`name() {` … `}`) หรือส่วนนอก function
function unguardedPrints(script: string): string[] {
  const bad: string[] = []
  let fn: string | null = null
  const scanned = new Set<string>()
  for (const [i, line] of script.split("\n").entries()) {
    const code = line.replace(/(^|\s)#.*$/, "")
    const open = code.match(/^([A-Za-z_][\w-]*)\(\)\s*\{/)
    if (open && !/\}\s*$/.test(code.trim())) {
      fn = open[1]
      continue
    }
    if (fn && /^\}/.test(code)) {
      fn = null
      continue
    }
    const block = fn ?? "<top>"
    if (/artifact-guard\.js scan "\$OUT"/.test(code)) scanned.add(block)
    // OPS-17c (AC-35 c): แยกคำสั่งตาม &&/||/;/| แล้วข้ามเฉพาะส่วนที่เป็น grep -q (ไม่ข้ามทั้งบรรทัด)
    const segments = code.split(/&&|\|\||;|\|/)
    const prints = segments.some((seg) => /(^|[\s({])(cat|grep)\s/.test(seg) && !/\bgrep -q\b/.test(seg))
    const reads = prints && /\$OUT|-console\.log/.test(code)
    if (!reads) continue
    if (/\|\s*node tools\/load\/artifact-guard\.js redact/.test(code)) continue
    if (scanned.has(block)) continue
    bad.push(`${i + 1}: ${line.trim()}`)
  }
  return bad
}

describe("OPS-17b run.sh: scan ก่อน cat/grep หรือผ่าน redact", () => {
  const runner = read("tools/load/run.sh")

  it("run.sh ไม่มี cat/grep ของ OUT/console ของ k6 ที่พิมพ์ก่อน scan หรือไม่ผ่าน redact", () => {
    expect(unguardedPrints(runner)).toEqual([])
  })

  it("console ของ k6 ใน k6() ส่งผ่าน artifact-guard.js redact ก่อนลง job log", () => {
    expect(runner).toMatch(/grep -v checkout_k6_timing "\$OUT\/\$1-console\.log"[^\n]*\| node tools\/load\/artifact-guard\.js redact/)
  })

  it("cleanup() และ flow หลักพิมพ์ report หลัง scan ในบล็อกเดียวกัน", () => {
    const body = runner.slice(runner.indexOf("cleanup() {"), runner.indexOf("\n}", runner.indexOf("cleanup() {")))
    expect(body.indexOf('artifact-guard.js scan "$OUT"')).toBeGreaterThan(-1)
    expect(body.indexOf('artifact-guard.js scan "$OUT"')).toBeLessThan(body.indexOf("cat "))
    const main = runner.slice(runner.indexOf("leaked=0"))
    expect(main.indexOf('artifact-guard.js scan "$OUT"')).toBeLessThan(main.indexOf("cat "))
  })

  it("positive control: fixture ที่สลับลำดับ (cat ก่อน scan) หรือ grep console ไม่ผ่าน redact → ถูกจับ", () => {
    const swapped = [
      "cleanup() {",
      '  [ -n "$REPORTED" ] || (cd "$OUT" && cat "${REPORTS[@]}" 2>/dev/null) || true',
      '  node tools/load/artifact-guard.js scan "$OUT" || true',
      "}",
    ].join("\n")
    expect(unguardedPrints(swapped)).toHaveLength(1)
    const raw = ["k6() {", '  grep -v checkout_k6_timing "$OUT/$1-console.log" 2>/dev/null || true', "}"].join("\n")
    expect(unguardedPrints(raw)).toHaveLength(1)
    const summary = ['(cd "$OUT" && cat report.md) >>"$GITHUB_STEP_SUMMARY"', 'node tools/load/artifact-guard.js scan "$OUT"'].join("\n")
    expect(unguardedPrints(summary)).toHaveLength(1)
    // scan ในบล็อกอื่น (function) ไม่นับเป็น scan ของ flow หลัก
    const otherBlock = ["cleanup() {", '  node tools/load/artifact-guard.js scan "$OUT"', "}", 'cat "$OUT/k6-failures.txt"'].join("\n")
    expect(unguardedPrints(otherBlock)).toHaveLength(1)
  })
})

// argument ของ console.(log|error|warn|info)( — นับวงเล็บจนปิด
function consoleArgs(src: string): string[] {
  const out: string[] = []
  const re = /console\.(log|error|warn|info)\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 1
    let j = m.index + m[0].length
    for (; j < src.length && depth > 0; j++) {
      if (src[j] === "(") depth++
      else if (src[j] === ")") depth--
    }
    out.push(src.slice(m.index + m[0].length, j - 1))
  }
  return out
}
// OPS-17c (AC-35 b): JSON.stringify( ของ object (เช่น response/request) อาจมี token
const SECRET_IDENT = /\b(token|authorization|headers|setup)\b|JSON\.stringify\(/i

describe("OPS-17b k6 script ไม่ส่ง token/header เข้า console.*", () => {
  it.each(["tools/load/flash-sale.js", "tools/load/group-buy-join.js"])("%s", (file) => {
    const args = consoleArgs(read(file))
    expect(args.length).toBeGreaterThan(0)
    expect(args.filter((a) => SECRET_IDENT.test(a))).toEqual([])
  })

  it("positive control: console ที่มี token/headers → ถูกจับ", () => {
    const args = consoleArgs("console.error(`x ${c.token}`)\nconsole.log(fmt(res.request.headers))\nconsole.info(`ok ${c.cart_id}`)")
    expect(args.filter((a) => SECRET_IDENT.test(a))).toHaveLength(2)
  })
})

// OPS-17c (spec 07 AC-35)
describe("OPS-17c (b) console.* ของ k6 script ปฏิเสธ JSON.stringify(", () => {
  it("positive control: console.log(JSON.stringify(res)) → ถูกจับ, ข้อความปกติไม่ถูกจับ", () => {
    const args = consoleArgs("console.log(JSON.stringify(res))\nconsole.info(`ok ${c.cart_id} ${res.status}`)")
    expect(args.filter((a) => SECRET_IDENT.test(a))).toEqual(["JSON.stringify(res)"])
  })
})

describe("OPS-17c (c) unguardedPrints ข้ามเฉพาะส่วน grep -q", () => {
  it("positive control: grep -q ... && cat \"$OUT/a\" ก่อน scan → ถูกจับ", () => {
    for (const op of ["&&", "||", ";", "|"]) {
      expect(unguardedPrints(`grep -q x "$OUT/a" ${op} cat "$OUT/a"\nnode tools/load/artifact-guard.js scan "$OUT"`)).toHaveLength(1)
    }
  })

  it("grep -q ล้วน (ไม่พิมพ์เนื้อหา) → ไม่ถูกจับ", () => {
    expect(unguardedPrints('grep -q "^failures: 0$" "$OUT/report.md" 2>/dev/null && passed=1')).toEqual([])
  })
})

describe("OPS-17c (a) stdout/stderr ของ docker run k6 ผ่าน redact และคง exit code ของ docker", () => {
  const runner = read("tools/load/run.sh")
  const start = runner.indexOf("k6() {")
  const k6Fn = runner.slice(start, runner.indexOf("\n}\n", start) + 3)

  it("stub docker พิมพ์ JWT ลง stdout/stderr แล้ว exit 99 → output ไม่มี JWT และ k6-failures.txt มี exit 99", () => {
    expect(start).toBeGreaterThan(-1)
    const token = fakeJwt()
    const bin = path.join(dir, "bin")
    const out = path.join(dir, "out")
    const data = path.join(dir, "data")
    for (const d of [bin, out, path.join(data, "k6")]) mkdirSync(d, { recursive: true })
    writeFileSync(
      path.join(bin, "docker"),
      `#!/usr/bin/env bash\necho "ERRO[0001] request failed body=${token}" >&2\necho "WARN stdout ${token}"\nexit 99\n`,
      { mode: 0o755 }
    )
    const script = [
      "set -euo pipefail",
      `OUT=${JSON.stringify(out)} DATA=${JSON.stringify(data)} PROJECT=t K6_IMAGE=k6 BURST_RATE=1 BURST_DURATION=1s FLASH_BURST=1`,
      k6Fn,
      "k6 flash-sale",
      'echo "after k6"',
    ].join("\n")
    const r = spawnSync("bash", ["-c", script], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    const output = r.stdout + r.stderr
    expect(r.status).toBe(0)
    expect(output).toContain("after k6")
    expect(output).toContain("ERRO[0001] request failed body=[REDACTED_JWT]")
    expect(output).toContain("WARN stdout [REDACTED_JWT]")
    expect(output).not.toMatch(JWT_RE)
    expect(readFileSync(path.join(out, "k6-failures.txt"), "utf8")).toContain("flash-sale: k6 exit 99")
  })

  it("docker run ใน k6() pipe ทั้ง stdout/stderr ผ่าน artifact-guard.js redact", () => {
    expect(k6Fn).toMatch(/"\/scripts\/\$1\.js" 2>&1 \| node tools\/load\/artifact-guard\.js redact/)
  })
})
