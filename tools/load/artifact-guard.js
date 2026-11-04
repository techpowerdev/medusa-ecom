// OPS-17a (docs/spec/07-scaling-ops.md AC-33): artifact ของ load run (OUT) ต้องไม่มี `setup_data` และ JWT ของลูกค้า load test
// - strip: summary ดิบของ k6 (--summary-export มี setup_data = ค่าที่ setup() คืน รวม token) → เขียนลง OUT โดยตัด setup_data
// - scan: ขั้นตรวจท้าย run — พบ JWT หรือ key setup_data ในไฟล์ใดของ OUT → ลบไฟล์นั้น (ไม่ให้ขึ้น artifact) แล้ว exit 1
// - redact (OPS-17b, AC-34): stdin → stdout แทนสตริงรูปแบบ JWT ด้วย [REDACTED_JWT] — stream (console ของ k6) ก่อนลง job log
// ใช้: node tools/load/artifact-guard.js strip <raw.json> <dest.json> | scan <dir> | redact < in
// CommonJS ล้วน ไม่มี dependency — unit test: apps/backend/src/__tests__/load-artifact-guard.unit.spec.ts
"use strict"

const fs = require("fs")
const path = require("path")

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./
const JWT_RE_G = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g
const SETUP_DATA_RE = /"setup_data"\s*:/

function stripSetupData(summary) {
  const { setup_data: _omit, ...rest } = summary
  return rest
}

// path แบบ relative กับ dir ของไฟล์ที่มี JWT หรือ key setup_data (ไล่โฟลเดอร์ย่อย)
function findLeaks(dir) {
  const out = []
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const p = path.join(rel, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.isFile()) {
        const text = fs.readFileSync(path.join(dir, p), "utf8")
        if (JWT_RE.test(text) || SETUP_DATA_RE.test(text)) out.push(p)
      }
    }
  }
  walk("")
  return out
}

const redact = (text) => text.replace(JWT_RE_G, "[REDACTED_JWT]")

module.exports = { stripSetupData, findLeaks, redact }

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === "strip") {
    fs.writeFileSync(b, JSON.stringify(stripSetupData(JSON.parse(fs.readFileSync(a, "utf8"))), null, 2))
  } else if (cmd === "scan") {
    const leaks = findLeaks(a)
    for (const p of leaks) fs.rmSync(path.join(a, p))
    if (leaks.length) {
      // พิมพ์เฉพาะชื่อไฟล์ — ไม่พิมพ์ token
      console.error(`AC-33: พบ JWT/setup_data ใน artifact (ลบไฟล์แล้ว): ${leaks.join(", ")}`)
      process.exit(1)
    }
  } else if (cmd === "redact") {
    // ทีละบรรทัด (JWT ไม่ข้ามบรรทัด) — ไม่ต้องรอ stream จบ
    const rl = require("readline").createInterface({ input: process.stdin, crlfDelay: Infinity })
    rl.on("line", (line) => process.stdout.write(redact(line) + "\n"))
  } else {
    console.error("ใช้: artifact-guard.js strip <raw.json> <dest.json> | scan <dir> | redact < in")
    process.exit(2)
  }
}
