import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { checkEvidenceBudget } from "./support/evidence-rules"
import { REPO_ROOT } from "./support/paths"

// บังคับกฎ CLAUDE.md ข้อ 6 กับทุกโฟลเดอร์ docs/evidence/<feature>/<task-id>/ ที่อยู่ใน repo
test("โฟลเดอร์ evidence ทุก task อยู่ในงบ (≤5 PNG, ≤300KB, ไม่มี trace/report เต็ม)", () => {
  const root = path.join(REPO_ROOT, "docs", "evidence")
  const violations: string[] = []

  for (const feature of fs.readdirSync(root, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    const featureDir = path.join(root, feature.name)
    for (const task of fs.readdirSync(featureDir, { withFileTypes: true })) {
      if (!task.isDirectory()) continue
      const taskDir = path.join(featureDir, task.name)
      const files = fs.readdirSync(taskDir, { withFileTypes: true }).map((f) =>
        f.isDirectory()
          ? { name: `${f.name}/`, bytes: 0 }
          : {
              name: f.name,
              bytes: fs.statSync(path.join(taskDir, f.name)).size,
            }
      )
      for (const v of checkEvidenceBudget(files)) {
        violations.push(`${feature.name}/${task.name}: ${v}`)
      }
    }
  }

  expect(violations).toEqual([])
})
