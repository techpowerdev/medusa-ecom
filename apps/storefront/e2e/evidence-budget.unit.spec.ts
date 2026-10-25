import { expect, test } from "@playwright/test"
import path from "node:path"

import { collectEvidenceViolations } from "./support/evidence-scan"
import { REPO_ROOT } from "./support/paths"

// บังคับกฎ CLAUDE.md ข้อ 6 และ docs/evidence/README.md กับทุกโฟลเดอร์ใน docs/evidence/
// ทั้งระดับ <feature>/ (เฉพาะ <TASK-ID>-tests.txt + <TASK-ID>/) และระดับ <TASK-ID>/ (≤5 PNG, ≤300KB, REPORT.md)
test("โฟลเดอร์ evidence ทุก feature/task อยู่ตาม convention และอยู่ในงบ", () => {
  expect(
    collectEvidenceViolations(path.join(REPO_ROOT, "docs", "evidence"))
  ).toEqual([])
})
