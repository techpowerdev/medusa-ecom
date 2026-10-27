import path from "node:path"

import { snapshotFiles } from "./support/evidence-save"
import { expect, test } from "./support/fixtures"
import { REPO_ROOT } from "./support/paths"

// CORE-5c AC-103 (กฎข้อ 67): spec ที่ไม่ตั้ง evidenceTarget เรียก step()/evidence() แล้วไม่เขียนไฟล์ใน docs/evidence
// แม้รันด้วย E2E_SAVE_EVIDENCE=1 — ไม่ต้องใช้ storefront/backend (เปิดหน้า data: URL)
const evidenceRoot = path.join(REPO_ROOT, "docs", "evidence")

test("ไม่ตั้ง evidenceTarget: step() และ evidence() ไม่เขียนไฟล์ evidence", async ({
  page,
  step,
  evidence,
}) => {
  const previous = process.env.E2E_SAVE_EVIDENCE
  process.env.E2E_SAVE_EVIDENCE = "1"
  try {
    const before = snapshotFiles(evidenceRoot)
    await step("เปิดหน้าทดสอบ", async () => {
      await page.goto("data:text/html,<h1>CORE-5c</h1>")
      await evidence("01-core-5c-no-target")
    })
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
  } finally {
    if (previous === undefined) delete process.env.E2E_SAVE_EVIDENCE
    else process.env.E2E_SAVE_EVIDENCE = previous
  }
})
