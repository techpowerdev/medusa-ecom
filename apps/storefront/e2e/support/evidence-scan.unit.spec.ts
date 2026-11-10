import { expect, test } from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { collectEvidenceViolations } from "./evidence-scan"

// CORE-5b AC-22: สแกน docs/evidence ทั้งระดับ feature และระดับ task
const roots: string[] = []
test.afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true })
})

function makeTree(files: Record<string, number>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-CORE-5b-"))
  roots.push(root)
  for (const [rel, bytes] of Object.entries(files)) {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, new Uint8Array(bytes))
  }
  return root
}

test.describe("collectEvidenceViolations", () => {
  test("ผ่านเมื่อทุกไฟล์อยู่ตาม convention", () => {
    const root = makeTree({
      "README.md": 10,
      "core/CORE-5-tests.txt": 10,
      "core/CORE-5/REPORT.md": 10,
      "core/CORE-5/01-a.png": 10,
      "core/CORE-4a-tests.txt": 10,
    })
    expect(collectEvidenceViolations(root)).toEqual([])
  })

  test("แจ้งไฟล์ระดับ feature ที่ไม่ตรง convention พร้อม path (AC-22)", () => {
    const root = makeTree({ "core/x.png": 10, "core/CORE-5.txt": 10 })
    expect([...collectEvidenceViolations(root)].sort()).toEqual([
      expect.stringContaining("core/CORE-5.txt"),
      expect.stringContaining("core/x.png"),
    ])
  })

  test("แจ้ง *-tests.txt ที่อยู่ในโฟลเดอร์ <TASK-ID>/ พร้อม path (AC-22)", () => {
    const root = makeTree({ "core/CORE-2/CORE-2-tests.txt": 10 })
    expect(collectEvidenceViolations(root)).toEqual([
      expect.stringContaining("core/CORE-2/CORE-2-tests.txt"),
    ])
  })
})
