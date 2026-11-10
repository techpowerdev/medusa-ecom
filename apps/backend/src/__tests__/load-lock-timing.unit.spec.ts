import { readFileSync } from "fs"
import { createRequire } from "module"
import path from "path"

// OPS-18 (spec 07 AC-29): สรุปเวลารอ/ถือ lock ของ flash checkout จาก log ของ server+worker หลัง load run
// parser เป็น JS ล้วนใน tools/load (รันด้วย node ของ runner ไม่เพิ่ม dependency)
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

type Entry = {
  cart_id: string
  requested_at: number
  acquired_at: number | null
  released_at: number | null
  wait_ms: number
  hold_ms: number | null
  outcome: string
}
type Stats = { min: number; median: number; p95: number; max: number }
type Summary = {
  count: number
  outcomes: Record<string, number>
  wait: Stats
  hold: Stats
  hold_count: number
  window_ms: number
  hold_sum_ms: number
  hold_sum_ratio: number
  hold_busy_ratio: number
  max_concurrent_holds: number
  wait_rank_corr: number
  hold_rank_corr: number
  wait_quartile_medians: number[]
  criteria: { hold_sum_ge_80: boolean; wait_grows_with_queue: boolean; serialized_by_lock: boolean }
}
const lockTiming = createRequire(__filename)(path.join(ROOT, "tools/load/lock-timing.js")) as {
  parseLockTimings: (text: string) => Entry[]
  summarizeLockTimings: (entries: Entry[]) => Summary | null
  renderLockTimingMarkdown: (summary: Summary | null) => string
}
const { parseLockTimings, summarizeLockTimings, renderLockTimingMarkdown } = lockTiming

const MARKER = "flash_sale_lock_timing"
const entry = (i: number, requested: number, wait: number, hold: number, outcome = "ok"): Entry => ({
  cart_id: `cart_${i}`,
  requested_at: requested,
  acquired_at: requested + wait,
  released_at: requested + wait + hold,
  wait_ms: wait,
  hold_ms: hold,
  outcome,
})
// บรรทัดแบบที่ JSON logger (winston json) เขียนลง stdout ของ container
const jsonLine = (e: Entry, workerMode = "server") =>
  JSON.stringify({ level: "debug", message: `${MARKER} ${JSON.stringify(e)}`, timestamp: "2026-11-03 10:00:00", worker_mode: workerMode })

describe("OPS-18 parseLockTimings", () => {
  it("อ่านเฉพาะบรรทัด JSON ที่ message ขึ้นต้นด้วย marker ข้ามบรรทัดอื่น/บรรทัดที่ไม่ใช่ JSON", () => {
    const a = entry(1, 1000, 5, 100)
    const b = entry(2, 1010, 0, 90, "FLASH_SOLD_OUT")
    const text = [
      "Attaching to server-1",
      JSON.stringify({ level: "http", message: "POST /store/carts/x/complete 200" }),
      jsonLine(a),
      `${MARKER} not json`,
      JSON.stringify({ level: "debug", message: `${MARKER} {broken` }),
      jsonLine(b, "worker"),
      "",
    ].join("\n")
    expect(parseLockTimings(text)).toEqual([a, b])
  })
})

describe("OPS-18 summarizeLockTimings", () => {
  it("ไม่มี entry → null และ markdown บอกว่าไม่พบ log", () => {
    expect(summarizeLockTimings([])).toBeNull()
    expect(renderLockTimingMarkdown(null)).toMatch(/ไม่พบ/)
  })

  it("min/median/p95/max ของ wait และ hold (percentile แบบ linear interpolation แบบเดียวกับ k6)", () => {
    // wait 0..19, hold 10..29 (ms) — ไม่สนใจลำดับใน input
    const entries = Array.from({ length: 20 }, (_, i) => entry(i, i * 1000, 19 - i, 29 - i))
    const s = summarizeLockTimings(entries)!
    expect(s.count).toBe(20)
    expect(s.wait).toEqual({ min: 0, median: 9.5, p95: 18.05, max: 19 })
    expect(s.hold).toEqual({ min: 10, median: 19.5, p95: 28.05, max: 29 })
  })

  it("นับ outcome และไม่นับ hold ที่ไม่ได้ lock (acquired_at = null) เข้าสถิติ hold", () => {
    const timeout: Entry = { ...entry(3, 0, 500, 0), acquired_at: null, released_at: null, hold_ms: null, outcome: "LOCK_ERROR" }
    const s = summarizeLockTimings([entry(1, 0, 0, 10), entry(2, 0, 0, 20, "FLASH_SOLD_OUT"), timeout])!
    expect(s.outcomes).toEqual({ ok: 1, FLASH_SOLD_OUT: 1, LOCK_ERROR: 1 })
    expect(s.hold).toEqual({ min: 10, median: 15, p95: 19.5, max: 20 })
  })

  it("ต่อคิวทีละตัว (hold ไม่ซ้อนกัน, wait โตตามลำดับขอ lock) → ยืนยัน serialize ทั้งสองเกณฑ์", () => {
    // ทุกตัวขอ lock ที่ t≈0 แล้วได้ทีละตัว ถือตัวละ 100ms
    const entries = Array.from({ length: 8 }, (_, i) => entry(i, i, i * 100 - i, 100))
    const s = summarizeLockTimings(entries)!
    expect(s.window_ms).toBe(800)
    expect(s.hold_sum_ms).toBe(800)
    expect(s.hold_sum_ratio).toBe(1)
    expect(s.hold_busy_ratio).toBe(1)
    expect(s.max_concurrent_holds).toBe(1)
    expect(s.wait_rank_corr).toBe(1)
    expect(s.wait_quartile_medians).toEqual([49.5, 247.5, 445.5, 643.5])
    expect(s.criteria).toEqual({ hold_sum_ge_80: true, wait_grows_with_queue: true, serialized_by_lock: true })
  })

  it("ทำงานขนานกัน (hold ซ้อนกัน, wait ≈ 0) → หักล้าง: wait ไม่โตตามคิว", () => {
    // 10 ตัวเริ่มพร้อมกันทุก 10ms ถือคนละ 1000ms — ผลรวม hold เกินช่วงเวลา แต่ไม่ได้รอกัน
    const entries = Array.from({ length: 10 }, (_, i) => entry(i, i * 10, i % 2, 1000))
    const s = summarizeLockTimings(entries)!
    expect(s.window_ms).toBe(1091)
    expect(s.hold_sum_ratio).toBeGreaterThan(1)
    expect(s.max_concurrent_holds).toBe(10)
    expect(s.criteria.hold_sum_ge_80).toBe(true)
    expect(s.criteria.wait_grows_with_queue).toBe(false)
    expect(s.criteria.serialized_by_lock).toBe(false)
  })

  it("hold โตตามคิวแม้ wait ≈ 0 → รายงาน hold_rank_corr (ต่อคิวภายใน lock เช่น row lock ของ DB)", () => {
    const entries = Array.from({ length: 6 }, (_, i) => entry(i, 0, 0, (i + 1) * 100))
    const s = summarizeLockTimings(entries)!
    expect(s.hold_rank_corr).toBe(1)
    expect(s.wait_rank_corr).toBe(0)
  })

  it("OPS-17 (AC-28) hold_rank_corr ใช้ลำดับในคิวทั้งหมด (ไม่ใช่ลำดับใน input/ใน held) — input สลับ + มีตัวที่ไม่ได้ lock แทรก", () => {
    // ขอ lock ที่ t = 0..6 (input เรียงกลับ), hold ลดลงตามคิวยกเว้นคู่ที่ขอพร้อมกัน, ตัวที่ t=3 lock ไม่สำเร็จ, ตัวที่ t=4,5 ขอพร้อมกัน (คงลำดับ log)
    const timeout: Entry = { ...entry(3, 3, 500, 0), acquired_at: null, released_at: null, hold_ms: null, outcome: "LOCK_ERROR" }
    const entries = [entry(6, 6, 0, 10), entry(5, 4, 0, 20), entry(4, 4, 0, 30), timeout, entry(2, 2, 0, 50), entry(1, 1, 0, 60), entry(0, 0, 0, 70)]
    const s = summarizeLockTimings(entries)!
    expect(s.hold_count).toBe(6)
    expect(s.hold_rank_corr).toBe(-0.94)
  })

  it("markdown มีตาราง (a)/(b) min/median/p95/max และผลเกณฑ์", () => {
    const md = renderLockTimingMarkdown(summarizeLockTimings([entry(1, 0, 1, 10), entry(2, 5, 2, 20)]))
    expect(md).toMatch(/\| \(a\) เวลารอ lock \| 2 \| 1 \| 1\.5 \| 1\.95 \| 2 \|/)
    expect(md).toMatch(/\| \(b\) เวลาถือ lock \| 2 \| 10 \| 15 \| 19\.5 \| 20 \|/)
    expect(md).toMatch(/≥ 80%/)
    expect(md).toMatch(/serialize/)
  })
})

describe("OPS-18 run.sh เก็บ log ของ load run", () => {
  const runner = read("tools/load/run.sh")

  it("ตั้ง LOG_LEVEL=debug เฉพาะ load run และค่าเริ่มต้นของ compose prod ยังเป็น info", () => {
    expect(runner).toMatch(/^export LOG_LEVEL="\$\{LOG_LEVEL:-debug\}"/m)
    expect(read("docker-compose.prod.yml")).toContain("LOG_LEVEL: ${LOG_LEVEL:-info}")
  })

  it("ดึง log ของ server+worker ทุก run (ไม่ใช่แค่ตอนล้ม) แล้วสรุปลง tools/load/out", () => {
    const pos = runner.indexOf("lock-timing.js")
    expect(pos).toBeGreaterThan(-1)
    expect(runner.indexOf("compose logs --no-color --no-log-prefix server worker")).toBeLessThan(pos)
    expect(pos).toBeLessThan(runner.indexOf('grep -q "^failures: 0$"'))
    expect(runner).toMatch(/\$OUT\/lock-timing\.md/)
  })
})
