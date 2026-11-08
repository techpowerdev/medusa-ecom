// OPS-20b (docs/spec/07-scaling-ops.md AC-32): ตัวชี้วัดความอิ่มตัวรายวินาทีใน "ช่วง checkout" (นิยามเดียวกับ AC-31)
// - event-loop delay ของ server/worker + รอ pool ของ knex: log debug `saturation_sample` (apps/backend/src/lib/saturation-sampler.ts)
// - CPU ต่อ container: `docker stats --no-stream` ที่ run.sh sample (100% = 1 core)
// - connection ของ Postgres แยก state/wait_event_type: `pg_stat_activity` ที่ run.sh sample
// ใช้: node tools/load/saturation.js <backend.log> <docker.jsonl> <pg.jsonl> <checkout-timing.json> [summary.json] > saturation.md
// CommonJS ล้วน ไม่มี dependency — unit test: apps/backend/src/__tests__/load-saturation.unit.spec.ts
"use strict"

const { stats } = require("./lock-timing.js")

const MARKER = "saturation_sample"
// เกณฑ์ owner 2026-11-03 (AC-32)
const EL_P95_MS = 100
const CPU_MEDIAN = 90
const SERVICE_RE = /-(server|worker|postgres|redis)-\d+$/

const jsonLines = (text) => {
  const out = []
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch (_) {
      // บรรทัดไม่ครบ — ข้าม
    }
  }
  return out
}

function parseSamples(text) {
  const out = []
  for (const line of String(text).split("\n")) {
    if (!line.includes(MARKER)) continue
    try {
      const msg = JSON.parse(line).message
      if (typeof msg === "string" && msg.startsWith(MARKER + " ")) out.push(JSON.parse(msg.slice(MARKER.length + 1)))
    } catch (_) {
      // ไม่ใช่ JSON ครบ — ข้าม
    }
  }
  return out
}

function parseDockerStats(text) {
  const out = []
  for (const s of jsonLines(text)) {
    for (const c of s.containers || []) {
      const m = SERVICE_RE.exec(String(c.name))
      const cpu = parseFloat(String(c.cpu))
      if (m && !Number.isNaN(cpu)) out.push({ t: s.t, service: m[1], cpu })
    }
  }
  return out
}

function parsePgActivity(text) {
  return jsonLines(text).map((s) => {
    const r = { t: s.t, total: 0, state: {}, wait: {} }
    for (const row of s.rows || []) {
      const n = Number(row.n)
      const st = row.state || "none"
      const w = row.wait_event_type || "none"
      r.total += n
      r.state[st] = (r.state[st] || 0) + n
      r.wait[w] = (r.wait[w] || 0) + n
    }
    return r
  })
}

const stat = (values) => ({ n: values.length, ...stats(values) })
const num = (v) => (typeof v === "number" ? v : null)
const pick = (items, key) => items.map((i) => num(i[key])).filter((v) => v !== null)

function summarizeSaturation({ backendLog, dockerStats, pgActivity, window }) {
  const range = window ? [Date.parse(window.start), Date.parse(window.end)] : [-Infinity, Infinity]
  const inWindow = (x) => x.t >= range[0] && x.t <= range[1]
  const samples = parseSamples(backendLog).filter(inWindow)
  const server = samples.filter((s) => s.worker_mode === "server")
  const worker = samples.filter((s) => s.worker_mode === "worker")
  const docker = parseDockerStats(dockerStats).filter(inWindow)
  const pg = parsePgActivity(pgActivity).filter(inWindow)

  const metrics = {
    server_el_p95: stat(pick(server, "el_p95_ms")),
    server_el_max: stat(pick(server, "el_max_ms")),
    worker_el_p95: stat(pick(worker, "el_p95_ms")),
    worker_el_max: stat(pick(worker, "el_max_ms")),
    pool_pending: stat(pick(server, "pool_pending")),
    pool_used: stat(pick(server, "pool_used")),
  }
  for (const svc of ["server", "worker", "postgres", "redis"]) {
    metrics[`cpu_${svc}`] = stat(docker.filter((d) => d.service === svc).map((d) => d.cpu))
  }
  metrics.pg_total = stat(pg.map((p) => p.total))
  for (const kind of ["state", "wait"]) {
    const keys = [...new Set(pg.flatMap((p) => Object.keys(p[kind])))].sort()
    for (const k of keys) metrics[`pg_${kind}:${k}`] = stat(pg.map((p) => p[kind][k] || 0))
  }

  const timeline = []
  if (window && Number.isFinite(range[0])) {
    const maxIn = (items, sec, f) => {
      const v = items.filter((i) => Math.floor(i.t / 1000) === sec).map(f).filter((x) => x !== null)
      return v.length ? Math.max(...v) : null
    }
    for (let sec = Math.floor(range[0] / 1000); sec <= Math.floor(range[1] / 1000); sec++) {
      const cpu = (svc) => maxIn(docker.filter((d) => d.service === svc), sec, (d) => d.cpu)
      timeline.push({
        at: new Date(sec * 1000).toISOString(),
        server_el_p95: maxIn(server, sec, (s) => num(s.el_p95_ms)),
        worker_el_p95: maxIn(worker, sec, (s) => num(s.el_p95_ms)),
        pool_pending: maxIn(server, sec, (s) => num(s.pool_pending)),
        cpu_server: cpu("server"),
        cpu_worker: cpu("worker"),
        cpu_postgres: cpu("postgres"),
        pg_active: maxIn(pg, sec, (p) => p.state.active || 0),
        pg_lock: maxIn(pg, sec, (p) => p.wait.Lock || 0),
      })
    }
  }

  const crit = (key, m, field, hitFn) => {
    const value = m.n ? m[field] : null
    return { key, value, hit: value === null ? null : hitFn(value) }
  }
  const criteria = [
    crit("event_loop", metrics.server_el_p95, "p95", (v) => v >= EL_P95_MS),
    crit("cpu", metrics.cpu_server, "median", (v) => v >= CPU_MEDIAN),
    crit("pool", metrics.pool_pending, "p95", (v) => v > 0),
  ]
  return {
    window: window || null,
    samples: { server: server.length, worker: worker.length, docker: new Set(docker.map((d) => d.t)).size, pg: pg.length },
    metrics,
    timeline,
    criteria,
    saturated: criteria.some((c) => c.hit === true),
  }
}

const LABELS = {
  server_el_p95: "event-loop delay server (p95 ต่อวินาที, ms)",
  server_el_max: "event-loop delay server (max ต่อวินาที, ms)",
  worker_el_p95: "event-loop delay worker (p95 ต่อวินาที, ms)",
  worker_el_max: "event-loop delay worker (max ต่อวินาที, ms)",
  pool_pending: "รอ pool ของ knex ของ server (numPendingAcquires)",
  pool_used: "connection ที่ใช้อยู่ใน pool ของ server (numUsed)",
  cpu_server: "CPU server (% — 100 = 1 core)",
  cpu_worker: "CPU worker (%)",
  cpu_postgres: "CPU postgres (%)",
  cpu_redis: "CPU redis (%)",
  pg_total: "connection ของ Postgres ทั้งหมด (client backend)",
}
const CRITERIA = {
  event_loop: `p95 event-loop delay ของ server ≥ ${EL_P95_MS}ms`,
  cpu: `median CPU ของ server ≥ ${CPU_MEDIAN}% ของ 1 core`,
  pool: "p95 ของจำนวนรอ pool > 0",
}
const cell = (v) => (v === null || v === undefined ? "-" : v)

function renderSaturationMarkdown(s) {
  const out = ["## OPS-20b ตัวชี้วัดความอิ่มตัวในช่วง checkout", ""]
  out.push(s.window ? `ช่วง checkout: ${s.window.start} → ${s.window.end}` : "ช่วง checkout: ไม่พบ (checkout-timing.json ไม่มี window) — ใช้ sample ทั้ง run")
  out.push(`sample: server ${s.samples.server}, worker ${s.samples.worker}, docker stats ${s.samples.docker}, pg_stat_activity ${s.samples.pg}`, "")
  out.push("| ตัวชี้วัด | จำนวน | min | median | p95 | max |", "|---|---|---|---|---|---|")
  for (const [k, m] of Object.entries(s.metrics)) {
    const label = LABELS[k] || (k.startsWith("pg_state:") ? `Postgres state = ${k.slice(9)}` : `Postgres wait_event_type = ${k.slice(8)}`)
    out.push(m.n ? `| ${label} | ${m.n} | ${m.min} | ${m.median} | ${m.p95} | ${m.max} |` : `| ${label} | 0 | - | - | - | - |`)
  }
  out.push("", "| เกณฑ์ (AC-32) | ค่า | ผล |", "|---|---|---|")
  for (const c of s.criteria) out.push(`| ${CRITERIA[c.key]} | ${cell(c.value)} | ${c.hit === null ? "ไม่มีข้อมูล" : c.hit ? "เข้าเกณฑ์" : "ไม่เข้า"} |`)
  out.push("", `ผล: ${s.saturated ? "**อิ่มตัว**" : "ไม่อิ่มตัวตามเกณฑ์"}`, "")
  if (s.timeline.length) {
    out.push("### รายวินาที (ค่าสูงสุดของ sample ในวินาทีนั้น)", "")
    out.push("| เวลา (UTC) | EL p95 server | EL p95 worker | รอ pool | CPU server | CPU worker | CPU postgres | pg active | pg รอ Lock |")
    out.push("|---|---|---|---|---|---|---|---|---|")
    for (const r of s.timeline) {
      out.push(`| ${r.at} | ${cell(r.server_el_p95)} | ${cell(r.worker_el_p95)} | ${cell(r.pool_pending)} | ${cell(r.cpu_server)} | ${cell(r.cpu_worker)} | ${cell(r.cpu_postgres)} | ${cell(r.pg_active)} | ${cell(r.pg_lock)} |`)
    }
    out.push("")
  }
  return out.join("\n")
}

module.exports = { parseSamples, parseDockerStats, parsePgActivity, summarizeSaturation, renderSaturationMarkdown }

if (require.main === module) {
  const fs = require("fs")
  const [log, dockerFile, pgFile, timingFile, summaryOut] = process.argv.slice(2)
  const readOr = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "")
  const timing = readOr(timingFile)
  const window = timing ? (JSON.parse(timing) || {}).window || null : null
  const s = summarizeSaturation({ backendLog: readOr(log), dockerStats: readOr(dockerFile), pgActivity: readOr(pgFile), window })
  if (summaryOut) fs.writeFileSync(summaryOut, JSON.stringify(s, null, 2) + "\n")
  process.stdout.write(renderSaturationMarkdown(s))
}
