// OPS-17a (docs/spec/07-scaling-ops.md AC-33): artifact ของ load run (OUT) ต้องไม่มี `setup_data` และ JWT ของลูกค้า load test
// - strip: summary ดิบของ k6 (--summary-export มี setup_data = ค่าที่ setup() คืน รวม token) → เขียนลง OUT โดยตัด setup_data
// - scan: ขั้นตรวจท้าย run — พบ JWT หรือ key setup_data ในไฟล์ใดของ OUT → ลบไฟล์นั้น (ไม่ให้ขึ้น artifact) แล้ว exit 1
// ใช้: node tools/load/artifact-guard.js strip <raw.json> <dest.json> | scan <dir>
// CommonJS ล้วน ไม่มี dependency — unit test: apps/backend/src/__tests__/load-artifact-guard.unit.spec.ts
"use strict"

const fs = require("fs")
const path = require("path")

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./
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

module.exports = { stripSetupData, findLeaks }

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
  } else {
    console.error("ใช้: artifact-guard.js strip <raw.json> <dest.json> | scan <dir>")
    process.exit(2)
  }
}
