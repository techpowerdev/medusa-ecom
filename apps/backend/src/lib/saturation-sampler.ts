import { monitorEventLoopDelay } from "perf_hooks"

/** OPS-20b (spec 07 AC-32): prefix ของบรรทัด log sample รายวินาที — `tools/load/saturation.js` อ่านบรรทัดนี้ */
export const SATURATION_MARKER = "saturation_sample"

type Env = Record<string, string | undefined>
type Histogram = Pick<ReturnType<typeof monitorEventLoopDelay>, "enable" | "disable" | "reset" | "percentile" | "max" | "mean">
/** pool ของ knex (tarn) ที่ `PG_CONNECTION.client.pool` */
type Pool = { numPendingAcquires(): number; numUsed(): number; numFree(): number }

// instrumentation.ts กับ middleware อาจได้ instance ของ module คนละตัว (dynamicImport ของ Medusa) → เก็บบน globalThis
const POOL_KEY = Symbol.for("ops20b.saturation.knex_pool")
const store = globalThis as unknown as Record<symbol, Pool | undefined>

const isPool = (p: unknown): p is Pool =>
  !!p && ["numPendingAcquires", "numUsed", "numFree"].every((k) => typeof (p as Record<string, unknown>)[k] === "function")

/** รับ knex ของ `PG_CONNECTION` — instrumentation ไม่มี container จึงให้ middleware ของ checkout ส่งเข้ามา */
export function setSamplerPool(knex: unknown): void {
  const pool = (knex as { client?: { pool?: unknown } } | undefined)?.client?.pool
  store[POOL_KEY] = isPool(pool) ? pool : undefined
}

export function getSamplerPool(): Pool | undefined {
  return store[POOL_KEY]
}

// Node ≥ 16 บันทึกช่วงห่างระหว่าง timer ทั้งช่วง (รวม resolution) → ลบ resolution ออกให้เหลือเฉพาะส่วนที่ช้ากว่ากำหนด
const RESOLUTION_MS = 10
const delayMs = (ns: number) => Math.max(0, Math.round((ns / 1e6 - RESOLUTION_MS) * 100) / 100)

export type SamplerOptions = {
  env: Env
  logger: { debug(message: string): unknown }
  intervalMs?: number
  now?: () => number
  setIntervalFn?: (fn: () => void, ms: number) => NodeJS.Timeout
  clearIntervalFn?: (t: NodeJS.Timeout) => void
  createHistogram?: () => Histogram
}

/**
 * event-loop delay (`perf_hooks.monitorEventLoopDelay`) + รอ pool ของ knex รายวินาที เป็น log debug ของ logger เดิม
 * สร้าง histogram/timer **เฉพาะ `LOG_LEVEL=debug`** (load run) — prod ไม่มี timer; คืนฟังก์ชันหยุด หรือ undefined
 */
export function startSaturationSampler({
  env,
  logger,
  intervalMs = 1000,
  now = Date.now,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  createHistogram = () => monitorEventLoopDelay({ resolution: RESOLUTION_MS }),
}: SamplerOptions): (() => void) | undefined {
  if (env.LOG_LEVEL !== "debug") {
    return undefined
  }
  const workerMode = env.MEDUSA_WORKER_MODE || "shared"
  const h = createHistogram()
  h.enable()
  const timer = setIntervalFn(() => {
    const pool = getSamplerPool()
    const entry = {
      t: now(),
      worker_mode: workerMode,
      el_p50_ms: delayMs(h.percentile(50)),
      el_p95_ms: delayMs(h.percentile(95)),
      el_p99_ms: delayMs(h.percentile(99)),
      el_max_ms: delayMs(h.max),
      el_mean_ms: delayMs(h.mean),
      pool_pending: pool ? pool.numPendingAcquires() : null,
      pool_used: pool ? pool.numUsed() : null,
      pool_free: pool ? pool.numFree() : null,
    }
    h.reset()
    logger.debug(`${SATURATION_MARKER} ${JSON.stringify(entry)}`)
  }, intervalMs)
  timer.unref()
  return () => {
    clearIntervalFn(timer)
    h.disable()
  }
}
