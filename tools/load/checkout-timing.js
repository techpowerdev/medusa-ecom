// OPS-20a (docs/spec/07-scaling-ops.md AC-31): แยกเวลา checkout flash ต่อ request เป็นช่วง (a)–(e)
// (a) checkout ทั้ง request จาก k6 (`checkout_k6_timing` ใน console ของ k6)
// (b) เข้า middleware ของ POST /store/carts/:id/complete → ต้น handler รวม complete-cart-validate.ts
// (c) ต้น → ท้าย handler รวม (รอ/ถือ lock ของ OPS-18 เป็นส่วนย่อย)  (d) ท้าย handler → `res` finish
// (e) = (a) − (b+c+d) — คิว event loop/accept, middleware ส่วนกลาง/authenticate/ownership, เครือข่ายใน runner
// ใช้: node tools/load/checkout-timing.js <backend.log> <k6-console.log> [rows.jsonl] [summary.json] > checkout-timing.md
//      node tools/load/checkout-timing.js --compare <summary-burst.json> <summary-no-burst.json>
// CommonJS ล้วน ไม่มี dependency — unit test: apps/backend/src/__tests__/load-checkout-timing.unit.spec.ts
"use strict"

const { parseLockTimings, stats } = require("./lock-timing.js")

const PHASE_MARKER = "checkout_phase_timing"
const K6_MARKER = "checkout_k6_timing"
const MAIN_PHASE_RATIO = 0.5 // ช่วงหลัก = median ≥ 50% ของ median (a)
const BURST_MAIN = 0.2 // median (a) ไม่มี burst ≤ 20% ของมี burst → burst เป็นสาเหตุหลัก
const WORKFLOW_MAIN = 0.8 // ≥ 80% → workflow เอง
const PHASES = ["b", "c", "d", "e"]
const K6_RE = new RegExp(`${K6_MARKER} cart_id=([^\\s"]+) status=(\\d+) outcome=([^\\s"]+) started_at=(\\d+) duration_ms=([\\d.]+)`)

function parseK6Checkouts(text) {
  const out = []
  for (const line of String(text).split("\n")) {
    const m = K6_RE.exec(line)
    if (m) out.push({ cart_id: m[1], status: Number(m[2]), outcome: m[3], started_at: Number(m[4]), duration_ms: Number(m[5]) })
  }
  return out
}

function parsePhaseTimings(text) {
  const out = []
  for (const line of String(text).split("\n")) {
    if (!line.includes(PHASE_MARKER)) continue
    try {
      const msg = JSON.parse(line).message
      if (typeof msg === "string" && msg.startsWith(PHASE_MARKER + " ")) {
        const e = JSON.parse(msg.slice(PHASE_MARKER.length + 1))
        if (e.phase === "route" || e.phase === "hook") out.push(e)
      }
    } catch (_) {
      // บรรทัดที่ไม่ใช่ JSON ครบ (เช่น log ถูกตัด) — ข้าม
    }
  }
  return out
}

const firstBy = (items) => {
  const m = new Map()
  for (const i of items) if (!m.has(i.cart_id)) m.set(i.cart_id, i)
  return m
}

/** รวมข้อมูลต่อ checkout ด้วย cart_id — ไม่มี log ของ server → ช่วงที่คิดไม่ได้เป็น null */
function joinCheckoutTimings(k6, phases, locks) {
  const routes = firstBy(phases.filter((p) => p.phase === "route"))
  const hooks = firstBy(phases.filter((p) => p.phase === "hook"))
  const lockBy = firstBy(locks)
  return k6.map((k) => {
    const r = routes.get(k.cart_id)
    const h = r ? hooks.get(k.cart_id) : undefined
    const l = lockBy.get(k.cart_id)
    return {
      cart_id: k.cart_id,
      outcome: k.outcome,
      a: k.duration_ms,
      b: h ? h.started_at - r.entered_at : null,
      c: h ? h.ended_at - h.started_at : null,
      d: h ? r.finished_at - h.ended_at : null,
      e: r ? Math.round((k.duration_ms - (r.finished_at - r.entered_at)) * 100) / 100 : null,
      lock_wait: l ? l.wait_ms : null,
      lock_hold: l && l.hold_ms !== null ? l.hold_ms : null,
      entered_at: r ? r.entered_at : null,
      finished_at: r ? r.finished_at : null,
    }
  })
}

const values = (rows, key) => rows.map((r) => r[key]).filter((v) => v !== null)

function summarizeGroup(rows) {
  const g = { count: rows.length, complete: rows.filter((r) => PHASES.every((p) => r[p] !== null)).length, n: {} }
  for (const key of ["a", ...PHASES, "lock_wait", "lock_hold"]) {
    const v = values(rows, key)
    g[key] = stats(v)
    g.n[key] = v.length
  }
  g.main_phases = PHASES.filter((p) => values(rows, p).length && g[p].median >= MAIN_PHASE_RATIO * g.a.median)
  return g
}

function summarizeCheckoutTimings(rows) {
  if (!rows.length) return null
  const outcomes = {}
  for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1
  const groups = { all: summarizeGroup(rows) }
  for (const o of Object.keys(outcomes)) groups[o] = summarizeGroup(rows.filter((r) => r.outcome === o))
  const entered = values(rows, "entered_at")
  const finished = values(rows, "finished_at")
  const window = entered.length
    ? (() => {
        const start = Math.min(...entered)
        const end = Math.max(...finished)
        return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), ms: end - start }
      })()
    : null
  return { count: rows.length, outcomes, groups, window }
}

function compareBurst(withBurst, withoutBurst) {
  const ratio = withoutBurst.groups.all.a.median / withBurst.groups.all.a.median
  const verdict = ratio <= BURST_MAIN ? "burst เป็นสาเหตุหลัก" : ratio >= WORKFLOW_MAIN ? "workflow เอง" : "ทั้งสอง"
  return { ratio, verdict }
}

const LABELS = {
  a: "(a) checkout ทั้ง request (k6)",
  b: "(b) ก่อน hook (เข้า middleware → ต้น handler)",
  c: "(c) ใน hook (ต้น → ท้าย handler)",
  lock_wait: "(c) ส่วนย่อย: รอ lock (OPS-18)",
  lock_hold: "(c) ส่วนย่อย: ถือ lock (OPS-18)",
  d: "(d) หลัง hook (ท้าย handler → res finish)",
  e: "(e) ก่อนถึง middleware + หลัง response = (a) − (b+c+d)",
}

function renderCheckoutTimingMarkdown(s) {
  if (!s) return "## OPS-20a ช่วงเวลา checkout flash\n\nไม่พบบรรทัด `" + K6_MARKER + "` ใน console ของ k6 (ไม่มี checkout)\n"
  const out = [
    "## OPS-20a ช่วงเวลา checkout flash (ms)",
    "",
    `checkout: ${s.count} — outcome: ${Object.entries(s.outcomes).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    s.window
      ? `ช่วง checkout (request แรกเข้า middleware → response สุดท้าย finish): ${s.window.start} → ${s.window.end} (${s.window.ms} ms)`
      : "ช่วง checkout: ไม่พบ log `" + PHASE_MARKER + "` ของ server (LOG_LEVEL ไม่ใช่ debug?)",
    "",
  ]
  for (const [name, g] of Object.entries(s.groups)) {
    out.push(`### ${name === "all" ? "รวม" : name} (${g.count} checkout, มีครบทุกช่วง ${g.complete})`, "")
    out.push("| ช่วง | จำนวน | min | median | p95 | max |", "|---|---|---|---|---|---|")
    for (const key of ["a", "b", "c", "lock_wait", "lock_hold", "d", "e"]) {
      const st = g[key]
      out.push(`| ${LABELS[key]} | ${g.n[key]} | ${st.min} | ${st.median} | ${st.p95} | ${st.max} |`)
    }
    out.push("", `ช่วงหลัก (median ≥ 50% ของ median (a)): ${g.main_phases.length ? g.main_phases.map((p) => `(${p})`).join(", ") : "ไม่มี"}`, "")
  }
  return out.join("\n")
}

module.exports = {
  parseK6Checkouts,
  parsePhaseTimings,
  joinCheckoutTimings,
  summarizeCheckoutTimings,
  compareBurst,
  renderCheckoutTimingMarkdown,
}

if (require.main === module) {
  const fs = require("fs")
  const args = process.argv.slice(2)
  if (args[0] === "--compare") {
    const [burst, noBurst] = args.slice(1).map((f) => JSON.parse(fs.readFileSync(f, "utf8")))
    const r = compareBurst(burst, noBurst)
    process.stdout.write(`median (a) ไม่มี burst / มี burst = ${Math.round(r.ratio * 1000) / 10}% → ${r.verdict}\n`)
  } else {
    const backend = fs.readFileSync(args[0], "utf8")
    const rows = joinCheckoutTimings(parseK6Checkouts(fs.readFileSync(args[1], "utf8")), parsePhaseTimings(backend), parseLockTimings(backend))
    const summary = summarizeCheckoutTimings(rows)
    if (args[2]) fs.writeFileSync(args[2], rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""))
    if (args[3]) fs.writeFileSync(args[3], JSON.stringify(summary, null, 2) + "\n")
    process.stdout.write(renderCheckoutTimingMarkdown(summary))
  }
}
