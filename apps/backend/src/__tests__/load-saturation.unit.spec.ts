import { readFileSync } from "fs"
import { createRequire } from "module"
import path from "path"

// OPS-20b (spec 07 AC-32): ตัวชี้วัดความอิ่มตัวรายวินาทีใน "ช่วง checkout" (นิยามเดียวกับ AC-31)
// event-loop delay ของ server/worker + รอ pool ของ knex (log debug `saturation_sample`), CPU ต่อ container (`docker stats`),
// connection ของ Postgres แยก state/wait_event_type (`pg_stat_activity`) — analyzer JS ล้วนใน tools/load ไม่เพิ่ม dependency
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

type Stat = { n: number; min: number; median: number; p95: number; max: number }
type Criterion = { key: string; value: number | null; hit: boolean | null }
type Summary = {
  window: { start: string; end: string } | null
  samples: Record<string, number>
  metrics: Record<string, Stat>
  timeline: Array<Record<string, number | string | null>>
  criteria: Criterion[]
  saturated: boolean
}
type Input = { backendLog: string; dockerStats: string; pgActivity: string; window: { start: string; end: string } | null }
const sat = createRequire(__filename)(path.join(ROOT, "tools/load/saturation.js")) as {
  parseSamples: (text: string) => Array<Record<string, number | string | null>>
  parseDockerStats: (text: string) => Array<{ t: number; service: string; cpu: number }>
  parsePgActivity: (text: string) => Array<{ t: number; total: number; state: Record<string, number>; wait: Record<string, number> }>
  summarizeSaturation: (input: Input) => Summary
  renderSaturationMarkdown: (s: Summary) => string
}

const MARKER = "saturation_sample"
const T0 = Date.parse("2026-11-09T10:00:00.000Z")
const sample = (o: Record<string, unknown>) =>
  JSON.stringify({ level: "debug", message: `${MARKER} ${JSON.stringify({ pool_pending: null, pool_used: null, pool_free: null, ...o })}`, worker_mode: o.worker_mode })
const docker = (t: number, server: string, worker = "1.00%", postgres = "50.00%") =>
  JSON.stringify({
    t,
    containers: [
      { name: "loadtest-server-1", cpu: server, mem: "1GiB / 7GiB" },
      { name: "loadtest-worker-1", cpu: worker, mem: "1GiB / 7GiB" },
      { name: "loadtest-postgres-1", cpu: postgres, mem: "1GiB / 7GiB" },
    ],
  })
const pg = (t: number, rows: Array<{ state: string; wait_event_type: string; n: number }>) => JSON.stringify({ t, rows })

function input(over: Partial<Input> = {}): Input {
  const lines: string[] = []
  for (let i = 0; i < 5; i++) {
    lines.push(sample({ t: T0 + i * 1000, worker_mode: "server", el_p95_ms: 10 + i * 30, el_max_ms: 200, pool_pending: i % 2 }))
    lines.push(sample({ t: T0 + i * 1000 + 10, worker_mode: "worker", el_p95_ms: 3, el_max_ms: 5 }))
  }
  lines.push(sample({ t: T0 + 60_000, worker_mode: "server", el_p95_ms: 9_999, el_max_ms: 9_999 })) // นอกช่วง checkout
  lines.push('{"level":"info","message":"Server is ready"}', "not json saturation_sample")
  return {
    backendLog: lines.join("\n"),
    dockerStats: [docker(T0 + 500, "95.00%"), docker(T0 + 1500, "101.50%"), docker(T0 + 2500, "80.00%"), docker(T0 + 90_000, "0.00%")].join("\n"),
    pgActivity: [
      pg(T0 + 400, [
        { state: "active", wait_event_type: "", n: 4 },
        { state: "idle", wait_event_type: "Client", n: 6 },
      ]),
      pg(T0 + 1400, [
        { state: "active", wait_event_type: "Lock", n: 2 },
        { state: "idle in transaction", wait_event_type: "Client", n: 1 },
      ]),
    ].join("\n"),
    window: { start: new Date(T0).toISOString(), end: new Date(T0 + 4_500).toISOString() },
    ...over,
  }
}

describe("OPS-20b parsers", () => {
  it("parseSamples อ่าน log JSON ของ logger เดิม ข้ามบรรทัดอื่น/ไม่ใช่ JSON", () => {
    const s = sat.parseSamples(input().backendLog)
    expect(s).toHaveLength(11)
    expect(s[0]).toMatchObject({ worker_mode: "server", el_p95_ms: 10, pool_pending: 0 })
  })

  it("parseDockerStats แปลง CPUPerc เป็นตัวเลขและชื่อ container เป็น service ของ compose", () => {
    const d = sat.parseDockerStats(docker(T0, "101.50%"))
    expect(d).toEqual([
      { t: T0, service: "server", cpu: 101.5 },
      { t: T0, service: "worker", cpu: 1 },
      { t: T0, service: "postgres", cpu: 50 },
    ])
  })

  it("parsePgActivity รวมจำนวน connection แยก state และ wait_event_type (ว่าง = none)", () => {
    const p = sat.parsePgActivity(input().pgActivity)
    expect(p[0]).toEqual({ t: T0 + 400, total: 10, state: { active: 4, idle: 6 }, wait: { none: 4, Client: 6 } })
  })
})

describe("OPS-20b summarizeSaturation", () => {
  it("min/median/p95/max เฉพาะ sample ในช่วง checkout แยก server/worker และ container", () => {
    const s = sat.summarizeSaturation(input())
    expect(s.samples).toMatchObject({ server: 5, worker: 5, docker: 3, pg: 2 })
    expect(s.metrics.server_el_p95).toMatchObject({ n: 5, min: 10, max: 130, median: 70 })
    expect(s.metrics.worker_el_p95).toMatchObject({ n: 5, min: 3, max: 3 })
    expect(s.metrics.cpu_server).toMatchObject({ n: 3, min: 80, median: 95, max: 101.5 })
    expect(s.metrics.pool_pending).toMatchObject({ n: 5, min: 0, max: 1 })
    // state/wait ที่ไม่มีใน sample หนึ่ง = 0 ของ sample นั้น
    expect(s.metrics["pg_state:active"]).toMatchObject({ n: 2, min: 2, max: 4 })
    expect(s.metrics["pg_state:idle in transaction"]).toMatchObject({ n: 2, min: 0, max: 1 })
    expect(s.metrics["pg_wait:Lock"]).toMatchObject({ n: 2, min: 0, max: 2 })
    expect(s.metrics.pg_total).toMatchObject({ min: 3, max: 10 })
  })

  it("timeline รายวินาทีพร้อม timestamp ISO เฉพาะในช่วง checkout", () => {
    const s = sat.summarizeSaturation(input())
    expect(s.timeline).toHaveLength(5)
    expect(s.timeline[0]).toMatchObject({ at: "2026-11-09T10:00:00.000Z", server_el_p95: 10, worker_el_p95: 3, cpu_server: 95, pg_active: 4 })
    expect(s.timeline[1]).toMatchObject({ server_el_p95: 40, cpu_server: 101.5, pg_lock: 2, pool_pending: 1 })
  })

  it("เกณฑ์ owner: p95 event-loop ของ server ≥ 100ms / median CPU server ≥ 90% / p95 รอ pool > 0 → อิ่มตัว", () => {
    const s = sat.summarizeSaturation(input())
    const by = Object.fromEntries(s.criteria.map((c) => [c.key, c]))
    expect(by.event_loop).toMatchObject({ hit: true })
    expect(by.cpu).toMatchObject({ value: 95, hit: true })
    expect(by.pool).toMatchObject({ hit: true })
    expect(s.saturated).toBe(true)
  })

  it("ทุกค่าต่ำกว่าเกณฑ์ → ไม่อิ่มตัว; ไม่มีข้อมูลของเกณฑ์ → hit = null (ไม่นับว่าผ่าน/ไม่ผ่าน)", () => {
    const low = [0, 1, 2].map((i) => sample({ t: T0 + i * 1000, worker_mode: "server", el_p95_ms: 12, el_max_ms: 30 })).join("\n")
    const s = sat.summarizeSaturation(input({ backendLog: low, dockerStats: docker(T0 + 500, "40.00%") }))
    const by = Object.fromEntries(s.criteria.map((c) => [c.key, c]))
    expect(by.event_loop.hit).toBe(false)
    expect(by.cpu.hit).toBe(false)
    expect(by.pool).toMatchObject({ value: null, hit: null })
    expect(s.saturated).toBe(false)
  })

  it("render: ช่วง checkout, จำนวน sample ของทั้งสอง process, ตารางสรุป, timeline และผลตามเกณฑ์", () => {
    const md = sat.renderSaturationMarkdown(sat.summarizeSaturation(input()))
    expect(md).toContain("2026-11-09T10:00:00.000Z → 2026-11-09T10:00:04.500Z")
    expect(md).toMatch(/server 5.*worker 5/)
    expect(md).toContain("| min | median | p95 | max |")
    expect(md).toContain("อิ่มตัว")
  })
})

describe("OPS-20b run.sh sampler", () => {
  const runner = read("tools/load/run.sh")

  it("sample docker stats --no-stream และ pg_stat_activity (state/wait_event_type ผ่าน psql ใน container postgres เดิม) ทุก LOAD_SAMPLE_INTERVAL วินาที", () => {
    expect(runner).toContain("docker stats --no-stream")
    expect(runner).toMatch(/pg_stat_activity/)
    expect(runner).toMatch(/GROUP BY[^\n]*/)
    expect(runner).toMatch(/state[\s\S]*wait_event_type/)
    expect(runner).toContain("LOAD_SAMPLE_INTERVAL:-1")
    // ไม่ดึงข้อความ query (อาจมีข้อมูลลูกค้า) — นับอย่างเดียว
    const sampler = runner.slice(runner.indexOf("sample_pg()"), runner.indexOf("}", runner.indexOf("sample_pg()")))
    expect(sampler).not.toMatch(/\bquery\b/)
  })

  it("เปิด sampler ก่อน k6 flash-sale และปิดหลังจบ; cleanup ปิด sampler เสมอ", () => {
    const start = runner.indexOf("start_samplers\n")
    expect(start).toBeGreaterThan(-1)
    expect(start).toBeLessThan(runner.indexOf("k6 flash-sale\n"))
    expect(runner.indexOf("stop_samplers\n", start)).toBeGreaterThan(runner.indexOf("k6 flash-sale\n"))
    const cleanup = runner.slice(runner.indexOf("cleanup() {"), runner.indexOf("trap cleanup EXIT"))
    expect(cleanup).toContain("stop_samplers")
  })

  it("สรุปด้วย saturation.js ลง OUT และพิมพ์ใน report (หลัง scan)", () => {
    expect(runner).toMatch(/node tools\/load\/saturation\.js [^\n]*checkout-timing\.json[\s\S]{0,80}>"\$OUT\/saturation\.md"/)
    expect(runner).toMatch(/REPORTS=\([^)]*saturation\.md[^)]*\)/)
  })
})
