import { existsSync, readFileSync } from "fs"
import path from "path"
import { parse } from "yaml"

// OPS-5: spec 07 AC-4 + Deliverables ข้อ 7 — runbook backup/restore ของ Postgres ใน docs/ops/database.md
const repoRoot = path.resolve(__dirname, "../../../..")
const RUNBOOK = "docs/ops/database.md"
const TITLE = "## Backup และ restore ของ Postgres"
const DRILL_EVIDENCE = "docs/evidence/ops/OPS-5-restore-drill.txt"

const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8")

/** เนื้อหาของหัวข้อ `## ...` จนถึงหัวข้อระดับ 2 ถัดไป */
function section(markdown: string, title: string): string {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === title)
  if (start < 0) {
    return ""
  }
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line))
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n")
}

describe("AC-4 runbook backup/restore", () => {
  const body = existsSync(path.join(repoRoot, RUNBOOK)) ? section(read(RUNBOOK), TITLE) : ""

  it(`มีหัวข้อ "${TITLE}" ใน ${RUNBOOK}`, () => {
    expect(body).not.toBe("")
  })

  it("ใช้ pg_dump/pg_restore ผ่าน service ที่มีอยู่จริงใน docker-compose.prod.yml", () => {
    const services = Object.keys(parse(read("docker-compose.prod.yml")).services)
    const compose = "docker compose -f docker-compose\\.prod\\.yml"
    // `exec -T <service> <คำสั่ง>` และ `stop|up -d --wait <service ...>`
    const used = [
      ...[...body.matchAll(new RegExp(`${compose} exec -T ([a-z]+)`, "g"))].map((m) => m[1]),
      ...[...body.matchAll(new RegExp(`${compose} (?:stop|up -d --wait) ([a-z ]+)`, "g"))].flatMap((m) =>
        m[1].trim().split(/\s+/)
      ),
    ]
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter((s) => !services.includes(s))).toEqual([])
    expect(body).toMatch(/exec -T postgres pg_dump .*--format=custom/)
    expect(body).toMatch(/exec -T postgres pg_restore .*--exit-on-error/)
  })

  it("ระบุสิ่งที่ต้องคงไว้นอก DB และสิ่งที่ไม่ backup", () => {
    // code/pin ของ e-voucher เป็น ciphertext — backup ใช้ไม่ได้ถ้าไม่มี key เดิม
    expect(body).toContain("EVOUCHER_ENCRYPTION_KEY")
    // Redis เป็น queue/cache/lock/session ไม่ backup และล้างหลัง restore
    expect(body).toMatch(/Redis[^\n]*ไม่ backup/)
    expect(body).toContain("redis-cli FLUSHALL")
  })

  it("มีบันทึกการซ้อม restore ที่อ้าง evidence ที่มีอยู่จริง", () => {
    expect(body).toContain(DRILL_EVIDENCE)
    expect(existsSync(path.join(repoRoot, DRILL_EVIDENCE))).toBe(true)
  })

  it("go-live checklist ใน docs/ops/production.md อ้าง runbook นี้", () => {
    expect(section(read("docs/ops/production.md"), "## Go-live checklist")).toContain(RUNBOOK)
  })
})
