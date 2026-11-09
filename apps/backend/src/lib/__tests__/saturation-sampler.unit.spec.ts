import {
  SATURATION_MARKER,
  getSamplerPool,
  setSamplerPool,
  startSaturationSampler,
} from "../saturation-sampler"

// OPS-20b (spec 07 AC-32): event-loop delay (+ รอ pool ของ knex) รายวินาที เป็น log debug ของ logger เดิม
// histogram/timer สร้างเฉพาะเมื่อ LOG_LEVEL=debug — prod (ค่าเริ่มต้น info) ไม่มี timer
const MS = 1e6 // histogram ของ perf_hooks เป็น nanosecond

function fakes() {
  const ticks: Array<() => void> = []
  const timer = { unref: jest.fn() }
  const setIntervalFn = jest.fn((fn: () => void, _ms: number) => {
    ticks.push(fn)
    return timer as unknown as NodeJS.Timeout
  })
  const clearIntervalFn = jest.fn()
  const histogram = {
    enable: jest.fn(),
    disable: jest.fn(),
    reset: jest.fn(),
    // ค่าดิบของ Node รวม resolution 10ms → log เฉพาะส่วนที่ช้ากว่ากำหนด
    percentile: jest.fn((p: number) => (p === 50 ? 12 * MS : p === 95 ? 50 * MS : 90 * MS)),
    max: 130 * MS,
    mean: 15.5 * MS,
  }
  const createHistogram = jest.fn(() => histogram)
  const lines: string[] = []
  const logger = { debug: (m: string) => lines.push(m) }
  return { ticks, timer, setIntervalFn, clearIntervalFn, histogram, createHistogram, lines, logger }
}

const parse = (line: string) => {
  expect(line.startsWith(`${SATURATION_MARKER} `)).toBe(true)
  return JSON.parse(line.slice(SATURATION_MARKER.length + 1))
}

describe("startSaturationSampler (OPS-20b)", () => {
  afterEach(() => setSamplerPool(undefined))

  it.each([{}, { LOG_LEVEL: "info" }, { LOG_LEVEL: "http" }])("LOG_LEVEL ไม่ใช่ debug (%j) → ไม่สร้าง histogram/interval", (env) => {
    const f = fakes()
    const stop = startSaturationSampler({ env, logger: f.logger, setIntervalFn: f.setIntervalFn, createHistogram: f.createHistogram })
    expect(stop).toBeUndefined()
    expect(f.setIntervalFn).not.toHaveBeenCalled()
    expect(f.createHistogram).not.toHaveBeenCalled()
  })

  it("LOG_LEVEL=debug → interval 1 วินาทีที่ unref (ไม่ค้าง process) และ log ทุก tick แล้ว reset histogram", () => {
    const f = fakes()
    const stop = startSaturationSampler({
      env: { LOG_LEVEL: "debug", MEDUSA_WORKER_MODE: "worker" },
      logger: f.logger,
      setIntervalFn: f.setIntervalFn,
      clearIntervalFn: f.clearIntervalFn,
      createHistogram: f.createHistogram,
      now: () => 1_700_000_000_123,
    })
    expect(f.setIntervalFn).toHaveBeenCalledTimes(1)
    expect(f.setIntervalFn.mock.calls[0][1]).toBe(1000)
    expect(f.timer.unref).toHaveBeenCalled()
    expect(f.histogram.enable).toHaveBeenCalled()

    f.ticks[0]()
    expect(f.lines).toHaveLength(1)
    expect(parse(f.lines[0])).toEqual({
      t: 1_700_000_000_123,
      worker_mode: "worker",
      el_p50_ms: 2,
      el_p95_ms: 40,
      el_p99_ms: 80,
      el_max_ms: 120,
      el_mean_ms: 5.5,
      pool_pending: null,
      pool_used: null,
      pool_free: null,
    })
    expect(f.histogram.reset).toHaveBeenCalledTimes(1)

    stop?.()
    expect(f.clearIntervalFn).toHaveBeenCalledWith(f.timer)
    expect(f.histogram.disable).toHaveBeenCalled()
  })

  it("ค่าดิบน้อยกว่า resolution (timer เร็วกว่ากำหนด) → 0 ไม่ติดลบ", () => {
    const f = fakes()
    f.histogram.percentile.mockImplementation(() => 9 * MS)
    startSaturationSampler({ env: { LOG_LEVEL: "debug" }, logger: f.logger, setIntervalFn: f.setIntervalFn, createHistogram: f.createHistogram })
    f.ticks[0]()
    expect(parse(f.lines[0]).el_p50_ms).toBe(0)
  })

  it("ไม่ตั้ง MEDUSA_WORKER_MODE → worker_mode = shared (เหมือน json-logger)", () => {
    const f = fakes()
    startSaturationSampler({ env: { LOG_LEVEL: "debug" }, logger: f.logger, setIntervalFn: f.setIntervalFn, createHistogram: f.createHistogram })
    f.ticks[0]()
    expect(parse(f.lines[0]).worker_mode).toBe("shared")
  })

  it("มี pool ของ knex (PG_CONNECTION) → log numPendingAcquires/numUsed/numFree", () => {
    const f = fakes()
    setSamplerPool({ client: { pool: { numPendingAcquires: () => 3, numUsed: () => 10, numFree: () => 0 } } })
    startSaturationSampler({ env: { LOG_LEVEL: "debug" }, logger: f.logger, setIntervalFn: f.setIntervalFn, createHistogram: f.createHistogram })
    f.ticks[0]()
    expect(parse(f.lines[0])).toMatchObject({ pool_pending: 3, pool_used: 10, pool_free: 0 })
  })
})

describe("setSamplerPool (OPS-20b)", () => {
  afterEach(() => setSamplerPool(undefined))

  it("รับ knex ที่มี client.pool แบบ tarn เท่านั้น — อย่างอื่นไม่ตั้ง", () => {
    setSamplerPool({})
    expect(getSamplerPool()).toBeUndefined()
    setSamplerPool({ client: { pool: {} } })
    expect(getSamplerPool()).toBeUndefined()
    const pool = { numPendingAcquires: () => 0, numUsed: () => 0, numFree: () => 0 }
    setSamplerPool({ client: { pool } })
    expect(getSamplerPool()).toBe(pool)
  })

  it("เก็บบน globalThis (Symbol.for) — instance ของ module ที่ instrumentation โหลดกับที่ middleware โหลดเห็นค่าเดียวกัน", () => {
    const pool = { numPendingAcquires: () => 0, numUsed: () => 0, numFree: () => 0 }
    setSamplerPool({ client: { pool } })
    expect((globalThis as Record<symbol, unknown>)[Symbol.for("ops20b.saturation.knex_pool")]).toBe(pool)
  })
})
