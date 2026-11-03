// OPS-18 (docs/spec/07-scaling-ops.md AC-29): สรุปเวลารอ lock (a) และเวลาถือ lock (b) ของ flash checkout
// จากบรรทัด debug `flash_sale_lock_timing {...}` ของ hook flash-sale-reservation.ts (JSON logger ของ OPS-3)
// ใช้: node tools/load/lock-timing.js <backend.log> [entries.jsonl] > lock-timing.md
// CommonJS ล้วน ไม่มี dependency (รันด้วย node ของ runner; ไม่ใช่ k6 script) — unit test: apps/backend/src/__tests__/load-lock-timing.unit.spec.ts
"use strict"

const MARKER = "flash_sale_lock_timing"
const HOLD_SUM_THRESHOLD = 0.8 // spec AC-29: ผลรวมเวลาถือ lock ≥ 80% ของช่วงเวลา checkout ทั้งหมด
const RANK_CORR_THRESHOLD = 0.8 // ตีความ "เวลารอโตตามลำดับคิว" = Spearman(ลำดับขอ lock, wait) ≥ 0.8 + median รายควอร์ไทล์ไม่ลดลง

function parseLockTimings(text) {
  const out = []
  for (const line of String(text).split("\n")) {
    if (!line.includes(MARKER)) continue
    try {
      const msg = JSON.parse(line).message
      if (typeof msg === "string" && msg.startsWith(MARKER + " ")) {
        out.push(JSON.parse(msg.slice(MARKER.length + 1)))
      }
    } catch (_) {
      // บรรทัดที่ไม่ใช่ JSON ครบ (เช่น log ถูกตัด) — ข้าม
    }
  }
  return out
}

const round = (n) => Math.round(n * 100) / 100

// percentile แบบ linear interpolation (แบบเดียวกับ k6) ของ array ที่เรียงแล้ว
function percentile(sorted, p) {
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function stats(values) {
  if (!values.length) return { min: 0, median: 0, p95: 0, max: 0 }
  const s = [...values].sort((a, b) => a - b)
  return { min: round(s[0]), median: round(percentile(s, 0.5)), p95: round(percentile(s, 0.95)), max: round(s[s.length - 1]) }
}

// rank เฉลี่ยเมื่อค่าเท่ากัน
function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const r = new Array(values.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2
    i = j + 1
  }
  return r
}

// Spearman = Pearson ของ rank; ค่าคงที่ (variance 0) → 0
function spearman(xs, ys) {
  if (xs.length < 2) return 0
  const a = ranks(xs)
  const b = ranks(ys)
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? round(num / Math.sqrt(da * db)) : 0
}

function summarizeLockTimings(entries) {
  if (!entries.length) return null
  // ลำดับคิว = ลำดับที่ขอ lock (stable sort — ค่าเท่ากันคงลำดับใน log)
  const queue = entries.map((e, i) => [e, i]).sort((x, y) => x[0].requested_at - y[0].requested_at || x[1] - y[1]).map((x) => x[0])
  const held = queue.filter((e) => e.acquired_at !== null && e.released_at !== null && e.hold_ms !== null)

  const outcomes = {}
  for (const e of queue) outcomes[e.outcome] = (outcomes[e.outcome] || 0) + 1

  const start = Math.min(...queue.map((e) => e.requested_at))
  const end = Math.max(...queue.map((e) => (e.released_at !== null ? e.released_at : e.requested_at + e.wait_ms)))
  const windowMs = end - start
  const holdSum = held.reduce((n, e) => n + e.hold_ms, 0)

  // sweep: ช่วงที่มี lock ถืออยู่อย่างน้อยหนึ่งตัว (busy) และจำนวนที่ถือพร้อมกันสูงสุด — ปล่อยก่อนได้ที่เวลาเดียวกัน
  const events = []
  for (const e of held) events.push([e.acquired_at, 1], [e.released_at, -1])
  events.sort((x, y) => x[0] - y[0] || x[1] - y[1])
  let active = 0
  let maxActive = 0
  let busy = 0
  let busySince = 0
  for (const [t, d] of events) {
    if (d === 1 && active === 0) busySince = t
    active += d
    if (d === -1 && active === 0) busy += t - busySince
    maxActive = Math.max(maxActive, active)
  }

  const positions = queue.map((_, i) => i)
  const waits = queue.map((e) => e.wait_ms)
  const quartiles = [0, 1, 2, 3].map((q) => {
    const part = waits.filter((_, i) => Math.floor((i * 4) / waits.length) === q)
    return part.length ? stats(part).median : 0
  })
  const waitCorr = spearman(positions, waits)
  const holdSumRatio = windowMs > 0 ? round(holdSum / windowMs) : 0
  const holdSumOk = holdSumRatio >= HOLD_SUM_THRESHOLD
  const waitGrows =
    waitCorr >= RANK_CORR_THRESHOLD && quartiles.every((m, i) => i === 0 || m >= quartiles[i - 1]) && quartiles[3] > quartiles[0]

  return {
    count: queue.length,
    outcomes,
    wait: stats(waits),
    hold: stats(held.map((e) => e.hold_ms)),
    hold_count: held.length,
    window_ms: windowMs,
    hold_sum_ms: holdSum,
    hold_sum_ratio: holdSumRatio,
    hold_busy_ratio: windowMs > 0 ? round(busy / windowMs) : 0,
    max_concurrent_holds: maxActive,
    wait_rank_corr: waitCorr,
    hold_rank_corr: spearman(
      held.map((e) => queue.indexOf(e)),
      held.map((e) => e.hold_ms)
    ),
    wait_quartile_medians: quartiles,
    criteria: { hold_sum_ge_80: holdSumOk, wait_grows_with_queue: waitGrows, serialized_by_lock: holdSumOk && waitGrows },
  }
}

const yes = (b) => (b ? "ใช่" : "ไม่")

function renderLockTimingMarkdown(s) {
  if (!s) return "## OPS-18 เวลา lock ของ flash checkout\n\nไม่พบบรรทัด `" + MARKER + "` ใน log (LOG_LEVEL ไม่ใช่ debug หรือไม่มี flash checkout)\n"
  const row = (label, n, st) => `| ${label} | ${n} | ${st.min} | ${st.median} | ${st.p95} | ${st.max} |`
  return [
    "## OPS-18 เวลา lock ของ flash checkout (ms)",
    "",
    `checkout ที่มี log: ${s.count} — outcome: ${Object.entries(s.outcomes).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    "",
    "| เวลา | จำนวน | min | median | p95 | max |",
    "|---|---|---|---|---|---|",
    row("(a) เวลารอ lock", s.count, s.wait),
    row("(b) เวลาถือ lock", s.hold_count, s.hold),
    "",
    "| ข้อมูลสำหรับเกณฑ์ | ค่า |",
    "|---|---|",
    `| ช่วงเวลา checkout (ขอ lock ตัวแรก → ปล่อย lock ตัวสุดท้าย) | ${s.window_ms} ms |`,
    `| ผลรวมเวลาถือ lock | ${s.hold_sum_ms} ms (${round(s.hold_sum_ratio * 100)}% ของช่วงเวลา) |`,
    `| ช่วงที่มี lock ถืออยู่อย่างน้อยหนึ่งตัว | ${round(s.hold_busy_ratio * 100)}% ของช่วงเวลา |`,
    `| lock ที่ถือพร้อมกันสูงสุด | ${s.max_concurrent_holds} |`,
    `| Spearman(ลำดับขอ lock, เวลารอ) | ${s.wait_rank_corr} |`,
    `| Spearman(ลำดับขอ lock, เวลาถือ) | ${s.hold_rank_corr} |`,
    `| median เวลารอ รายควอร์ไทล์ของคิว (Q1→Q4) | ${s.wait_quartile_medians.join(" → ")} |`,
    "",
    `- ผลรวมเวลาถือ lock ≥ 80% ของช่วงเวลา checkout: ${yes(s.criteria.hold_sum_ge_80)}`,
    `- เวลารอ lock โตตามลำดับคิว (Spearman ≥ ${RANK_CORR_THRESHOLD} และ median รายควอร์ไทล์ไม่ลดลง): ${yes(s.criteria.wait_grows_with_queue)}`,
    `- สรุปตามเกณฑ์ AC-29: checkout ถูก serialize ด้วย lock = ${s.criteria.serialized_by_lock ? "ยืนยัน" : "หักล้าง"}`,
    "",
  ].join("\n")
}

module.exports = { parseLockTimings, summarizeLockTimings, renderLockTimingMarkdown, stats } // stats: ใช้ร่วมกับ checkout-timing.js (OPS-20a)

if (require.main === module) {
  const fs = require("fs")
  const entries = parseLockTimings(fs.readFileSync(process.argv[2], "utf8"))
  if (process.argv[3]) fs.writeFileSync(process.argv[3], entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : ""))
  process.stdout.write(renderLockTimingMarkdown(summarizeLockTimings(entries)))
}
