import { readFileSync } from "fs"
import { createRequire } from "module"
import path from "path"
import { parse } from "yaml"

// OPS-20a (spec 07 AC-31): แยกเวลา checkout flash ต่อ request เป็นช่วง (a)–(e) จาก k6 + log debug ของ server
// analyzer เป็น JS ล้วนใน tools/load (ต่อจาก lock-timing.js ของ OPS-18 — ไม่เพิ่ม dependency)
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

type Stats = { min: number; median: number; p95: number; max: number }
type K6Checkout = { cart_id: string; status: number; outcome: string; started_at: number; duration_ms: number }
type Phase =
  | { phase: "route"; cart_id: string; entered_at: number; finished_at: number; status: number }
  | { phase: "hook"; cart_id: string; started_at: number; ended_at: number; outcome: string }
type Lock = { cart_id: string; wait_ms: number; hold_ms: number | null }
type Row = {
  cart_id: string
  outcome: string
  a: number
  b: number | null
  c: number | null
  d: number | null
  e: number | null
  lock_wait: number | null
  lock_hold: number | null
  entered_at: number | null
  finished_at: number | null
}
type Group = {
  count: number
  complete: number
  a: Stats
  b: Stats
  c: Stats
  d: Stats
  e: Stats
  lock_wait: Stats
  lock_hold: Stats
  main_phases: string[]
}
type Summary = {
  count: number
  outcomes: Record<string, number>
  groups: Record<string, Group>
  window: { start: string; end: string; ms: number } | null
}
const timing = createRequire(__filename)(path.join(ROOT, "tools/load/checkout-timing.js")) as {
  parseK6Checkouts: (text: string) => K6Checkout[]
  parsePhaseTimings: (text: string) => Phase[]
  joinCheckoutTimings: (k6: K6Checkout[], phases: Phase[], locks: Lock[]) => Row[]
  summarizeCheckoutTimings: (rows: Row[]) => Summary | null
  compareBurst: (withBurst: Summary, withoutBurst: Summary) => { ratio: number; verdict: string }
  renderCheckoutTimingMarkdown: (summary: Summary | null) => string
}
const {
  parseK6Checkouts,
  parsePhaseTimings,
  joinCheckoutTimings,
  summarizeCheckoutTimings,
  compareBurst,
  renderCheckoutTimingMarkdown,
} = timing

const PHASE_MARKER = "checkout_phase_timing"
const K6_MARKER = "checkout_k6_timing"
// บรรทัดที่ JSON logger (OPS-3) เขียนลง stdout ของ container
const jsonLine = (p: Phase) => JSON.stringify({ level: "debug", message: `${PHASE_MARKER} ${JSON.stringify(p)}`, worker_mode: "server" })
// บรรทัดที่ `k6 run --console-output` เขียน (logrus text)
const k6Line = (c: K6Checkout) =>
  `time="2026-11-03T10:54:23Z" level=info msg="${K6_MARKER} cart_id=${c.cart_id} status=${c.status} outcome=${c.outcome} started_at=${c.started_at} duration_ms=${c.duration_ms}" source=console`

describe("OPS-20a parsers", () => {
  it("parseK6Checkouts อ่านบรรทัด console ของ k6 (มี/ไม่มี quote ของ logrus) ข้ามบรรทัดอื่น", () => {
    const a: K6Checkout = { cart_id: "cart_1", status: 200, outcome: "ok", started_at: 1000, duration_ms: 5000.25 }
    const b: K6Checkout = { cart_id: "cart_2", status: 409, outcome: "FLASH_SOLD_OUT", started_at: 1001, duration_ms: 4000 }
    const text = [
      k6Line(a),
      `time="x" level=error msg="checkout cart_3: 500 {}" source=console`,
      `${K6_MARKER} cart_id=cart_2 status=409 outcome=FLASH_SOLD_OUT started_at=1001 duration_ms=4000`,
      `${K6_MARKER} broken`,
      "",
    ].join("\n")
    expect(parseK6Checkouts(text)).toEqual([a, b])
  })

  it("parsePhaseTimings อ่านเฉพาะ message ที่ขึ้นต้นด้วย marker และ phase ที่รู้จัก", () => {
    const route: Phase = { phase: "route", cart_id: "cart_1", entered_at: 1100, finished_at: 5900, status: 200 }
    const hook: Phase = { phase: "hook", cart_id: "cart_1", started_at: 2000, ended_at: 3000, outcome: "ok" }
    const text = [
      "Attaching to server-1",
      jsonLine(route),
      JSON.stringify({ level: "debug", message: `${PHASE_MARKER} {broken` }),
      JSON.stringify({ level: "debug", message: `${PHASE_MARKER} ${JSON.stringify({ phase: "other", cart_id: "x" })}` }),
      JSON.stringify({ level: "debug", message: `flash_sale_lock_timing {"cart_id":"cart_1"}` }),
      jsonLine(hook),
    ].join("\n")
    expect(parsePhaseTimings(text)).toEqual([route, hook])
  })
})

describe("OPS-20a joinCheckoutTimings", () => {
  it("(a)=k6, (b) เข้า middleware → ต้น hook, (c) ใน hook, (d) ท้าย hook → finish, (e)=(a)−(b+c+d); lock เป็นส่วนย่อย", () => {
    const rows = joinCheckoutTimings(
      [{ cart_id: "cart_1", status: 200, outcome: "ok", started_at: 1000, duration_ms: 5000 }],
      [
        { phase: "route", cart_id: "cart_1", entered_at: 1100, finished_at: 5900, status: 200 },
        { phase: "hook", cart_id: "cart_1", started_at: 2000, ended_at: 3000, outcome: "ok" },
      ],
      [{ cart_id: "cart_1", wait_ms: 10, hold_ms: 600 }]
    )
    expect(rows).toEqual([
      {
        cart_id: "cart_1",
        outcome: "ok",
        a: 5000,
        b: 900,
        c: 1000,
        d: 2900,
        e: 200,
        lock_wait: 10,
        lock_hold: 600,
        entered_at: 1100,
        finished_at: 5900,
      },
    ])
  })

  it("ไม่มี log ของ server สำหรับ cart → (b)–(e) เป็น null แต่ยังนับใน (a); ไม่มี hook → (b)–(d) null, (e) ยังคิดได้", () => {
    const rows = joinCheckoutTimings(
      [
        { cart_id: "cart_1", status: 200, outcome: "ok", started_at: 0, duration_ms: 100 },
        { cart_id: "cart_2", status: 400, outcome: "status_400", started_at: 0, duration_ms: 50 },
      ],
      [{ phase: "route", cart_id: "cart_2", entered_at: 10, finished_at: 40, status: 400 }],
      []
    )
    expect(rows[0]).toMatchObject({ a: 100, b: null, c: null, d: null, e: null, lock_wait: null, entered_at: null })
    expect(rows[1]).toMatchObject({ a: 50, b: null, c: null, d: null, e: 20, entered_at: 10, finished_at: 40 })
  })
})

describe("OPS-20a summarizeCheckoutTimings", () => {
  const row = (i: number, outcome: string, a: number, b: number, c: number, d: number, entered: number): Row => ({
    cart_id: `cart_${i}`,
    outcome,
    a,
    b,
    c,
    d,
    e: a - (b + c + d),
    lock_wait: 1,
    lock_hold: c / 2,
    entered_at: entered,
    finished_at: entered + b + c + d,
  })

  it("ไม่มี row → null และ markdown บอกว่าไม่พบ log", () => {
    expect(summarizeCheckoutTimings([])).toBeNull()
    expect(renderCheckoutTimingMarkdown(null)).toMatch(/ไม่พบ/)
  })

  it("แยกกลุ่มรวม + ตาม outcome, min/median/p95/max ต่อช่วง และช่วง checkout = เข้า middleware แรก → finish สุดท้าย", () => {
    const rows = [
      row(1, "ok", 1000, 100, 200, 600, 1_793_700_000_000),
      row(2, "ok", 2000, 100, 200, 1600, 1_793_700_000_500),
      row(3, "FLASH_SOLD_OUT", 3000, 2000, 300, 100, 1_793_700_000_100),
    ]
    const s = summarizeCheckoutTimings(rows)!
    expect(s.count).toBe(3)
    expect(s.outcomes).toEqual({ ok: 2, FLASH_SOLD_OUT: 1 })
    expect(Object.keys(s.groups)).toEqual(["all", "ok", "FLASH_SOLD_OUT"])
    expect(s.groups.all.a).toEqual({ min: 1000, median: 2000, p95: 2900, max: 3000 })
    expect(s.groups.ok.d).toEqual({ min: 600, median: 1100, p95: 1550, max: 1600 })
    expect(s.groups.FLASH_SOLD_OUT.count).toBe(1)
    expect(s.groups.all.complete).toBe(3)
    // ช่วงหลัก = ช่วงใน (b)–(e) ที่ median ≥ 50% ของ median (a)
    expect(s.groups.ok.main_phases).toEqual(["d"]) // median d 1100 ≥ 750
    expect(s.groups.FLASH_SOLD_OUT.main_phases).toEqual(["b"]) // b 2000 ≥ 1500
    // ช่วงเวลา: cart_1 เข้า 1_793_700_000_000 → cart_3 finish 1_793_700_000_100 + 2400 (ไม่ใช่ตัวที่เข้าท้ายสุด)
    expect(s.window).toEqual({
      start: new Date(1_793_700_000_000).toISOString(),
      end: new Date(1_793_700_002_500).toISOString(),
      ms: 2500,
    })
  })

  it("row ที่ไม่ครบไม่เข้าสถิติของ (b)–(e) แต่นับใน (a) และ complete นับเฉพาะ row ที่มีครบ", () => {
    const partial: Row = { ...row(9, "ok", 500, 0, 0, 0, 0), b: null, c: null, d: null, e: null, entered_at: null, finished_at: null }
    const s = summarizeCheckoutTimings([row(1, "ok", 1000, 100, 200, 600, 10), partial])!
    expect(s.groups.ok.count).toBe(2)
    expect(s.groups.ok.complete).toBe(1)
    expect(s.groups.ok.a).toEqual({ min: 500, median: 750, p95: 975, max: 1000 })
    expect(s.groups.ok.b).toEqual({ min: 100, median: 100, p95: 100, max: 100 })
  })

  it("markdown มีตาราง (a)–(e) + lock ต่อกลุ่ม, ช่วงหลัก และ timestamp ของช่วง checkout", () => {
    const md = renderCheckoutTimingMarkdown(summarizeCheckoutTimings([row(1, "ok", 1000, 100, 200, 600, 0)]))
    expect(md).toMatch(/\| \(a\) checkout ทั้ง request \(k6\) \| 1 \| 1000 \| 1000 \| 1000 \| 1000 \|/)
    expect(md).toMatch(/\| \(d\) หลัง hook/)
    expect(md).toMatch(/\| \(e\) ก่อนถึง middleware/)
    expect(md).toMatch(/รอ lock/)
    expect(md).toMatch(/ช่วงหลัก.*\(d\)/)
    expect(md).toContain(new Date(0).toISOString())
  })
})

describe("OPS-20a compareBurst (เกณฑ์ owner 2026-11-03)", () => {
  const withMedian = (m: number) => ({ groups: { all: { a: { median: m } } } }) as unknown as Summary
  it.each([
    [10_000, 2_000, "burst เป็นสาเหตุหลัก"],
    [10_000, 8_000, "workflow เอง"],
    [10_000, 5_000, "ทั้งสอง"],
  ])("median มี burst %d ms, ไม่มี burst %d ms → %s", (burst, noBurst, verdict) => {
    const r = compareBurst(withMedian(burst), withMedian(noBurst))
    expect(r.ratio).toBeCloseTo(noBurst / burst)
    expect(r.verdict).toBe(verdict)
  })
})

describe("OPS-20a flash_burst: load-nightly.yml → run.sh → k6", () => {
  const workflow = parse(read(".github/workflows/load-nightly.yml")) as {
    on: { schedule: unknown; workflow_dispatch: { inputs: Record<string, { default: string }> } }
    jobs: { load: { steps: { run?: string; env?: Record<string, string> }[] } }
  }
  const runner = read("tools/load/run.sh")
  const script = read("tools/load/flash-sale.js")

  it("workflow_dispatch มี input flash_burst ค่าเริ่มต้น = มี burst และส่งเป็น env LOAD_FLASH_BURST (schedule ไม่มี input → มี burst)", () => {
    expect(workflow.on.schedule).toBeDefined()
    expect(workflow.on.workflow_dispatch.inputs.flash_burst.default).toBe("1")
    const step = workflow.jobs.load.steps.find((s) => s.run === "tools/load/run.sh")!
    expect(step.env?.LOAD_FLASH_BURST).toBe("${{ inputs.flash_burst || '1' }}")
  })

  it("run.sh ค่าเริ่มต้นมี burst และส่ง LOAD_FLASH_BURST + เก็บ console ของ k6 แล้วสรุปด้วย checkout-timing.js ก่อน gate", () => {
    expect(runner).toContain('FLASH_BURST="${LOAD_FLASH_BURST:-1}"')
    expect(runner).toContain('-e LOAD_FLASH_BURST="$FLASH_BURST"')
    expect(runner).toContain("--console-output")
    const pos = runner.indexOf("checkout-timing.js")
    expect(pos).toBeGreaterThan(runner.indexOf("compose logs --no-color --no-log-prefix server worker"))
    expect(pos).toBeLessThan(runner.indexOf('grep -q "^failures: 0$"'))
  })

  it("flash-sale.js: LOAD_FLASH_BURST=0 ตัด scenario burst ออกจาก options.scenarios (ไม่ใช้ rate 0) และ log เวลา checkout ต่อ cart", () => {
    expect(script).toMatch(/if \(__ENV\.LOAD_FLASH_BURST === "0"\) \{[^}]*delete options\.scenarios\.burst/)
    expect(script).toMatch(/delete options\.thresholds\["http_req_duration\{scenario:burst\}"\]/)
    expect(script).toContain(`${K6_MARKER} cart_id=`)
  })
})
