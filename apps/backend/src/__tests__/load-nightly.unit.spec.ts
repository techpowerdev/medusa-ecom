import { existsSync, readFileSync } from "fs"
import path from "path"

// OPS-4 (spec 07 AC-2, AC-3, Q-O3 a–e): load test รายคืนแยกจาก ci.yml — ความถูกต้องเป็น gate,
// p95 รายงานอย่างเดียว, k6 pin เวอร์ชัน (ไม่เพิ่ม dependency ใน package.json), ผล k6 เป็น artifact 14 วัน
const ROOT = path.resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

describe("OPS-4 load-nightly", () => {
  const workflow = read(".github/workflows/load-nightly.yml")
  const runner = read("tools/load/run.sh")

  it("workflow แยกไฟล์ รันรายคืน + สั่งเองได้ และไม่อยู่ใน ci.yml", () => {
    expect(workflow).toMatch(/^\s+schedule:\s*\n\s+- cron: "[^"]+"/m)
    expect(workflow).toMatch(/^\s+workflow_dispatch:/m)
    expect(workflow).toContain("tools/load/run.sh")
    expect(read(".github/workflows/ci.yml")).not.toMatch(/tools\/load|k6/)
  })

  it("ผล k6 (--summary-export) อัปโหลดเป็น artifact 14 วันแม้ run ล้ม", () => {
    expect(runner).toContain("--summary-export")
    expect(workflow).toMatch(/uses: actions\/upload-artifact@v\d+[\s\S]*retention-days: 14/)
    expect(workflow).toMatch(/if: always\(\)\s*\n\s+uses: actions\/upload-artifact/)
  })

  it("บูต stack แบบ prod ของ OPS-1 ด้วย provider ทดสอบ และ k6 จาก image ที่ pin เวอร์ชัน", () => {
    expect(runner).toContain("docker-compose.prod.yml")
    expect(runner).toMatch(/ALLOW_TEST_PROVIDERS=.*true/)
    expect(runner).toMatch(/grafana\/k6:\d+\.\d+\.\d+/)
    expect(runner).not.toMatch(/grafana\/k6:latest/)
  })

  it("ค่าเริ่มต้นตาม AC-2 (300 คน, cap 100, 500 rps 60 วินาที) และ AC-3 (200 คน, กลุ่ม 10)", () => {
    for (const v of [
      "LOAD_FLASH_CUSTOMERS:-300",
      "LOAD_FLASH_TOTAL_CAP:-100",
      "LOAD_BURST_RATE:-500",
      "LOAD_BURST_DURATION:-60s",
      "LOAD_JOIN_CUSTOMERS:-200",
      "LOAD_GROUP_SIZE:-10",
    ]) {
      expect(runner).toContain(v)
    }
  })

  it.each(["tools/load/flash-sale.js", "tools/load/group-buy-join.js"])(
    "%s: 5xx = 0 เป็น threshold (gate) และไม่มี threshold ของ p95 (รายงานอย่างเดียว)",
    (file) => {
      expect(existsSync(path.join(ROOT, file))).toBe(true)
      const script = read(file)
      expect(script).toMatch(/http_5xx:\s*\["count==0"\]/)
      expect(script).not.toMatch(/p\(95\)\s*</)
    }
  )

  it("ตรวจผลจาก DB หลังจบ: order ที่มี adjustment ของแคมเปญ, units_sold และสมาชิกกลุ่ม", () => {
    expect(runner).toMatch(/order_line_item_adjustment/)
    expect(runner).toMatch(/units_sold/)
    expect(runner).toMatch(/group_buy_membership/)
  })
})
