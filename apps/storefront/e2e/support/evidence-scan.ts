import fs from "node:fs"
import path from "node:path"

import {
  EvidenceFile,
  checkEvidenceBudget,
  checkFeatureEntries,
} from "./evidence-rules"

/**
 * สแกน docs/evidence/ แล้วคืน violation ทั้งหมด (ขึ้นต้นด้วย path สัมพัทธ์จาก root)
 * - ระดับ <feature>/: เฉพาะ <TASK-ID>-tests.txt และโฟลเดอร์ <TASK-ID>/
 * - ระดับ <feature>/<TASK-ID>/: เฉพาะ REPORT.md + PNG ตามงบ
 */
export function collectEvidenceViolations(root: string): string[] {
  const violations: string[] = []

  for (const feature of fs.readdirSync(root, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    const featureDir = path.join(root, feature.name)
    const entries = fs.readdirSync(featureDir, { withFileTypes: true })

    const featureEntries = entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }))
    for (const v of checkFeatureEntries(featureEntries)) {
      violations.push(`${feature.name}/${v}`)
    }

    for (const task of entries) {
      if (!task.isDirectory()) continue
      const taskDir = path.join(featureDir, task.name)
      const rel = `${feature.name}/${task.name}`
      const files: EvidenceFile[] = fs
        .readdirSync(taskDir, { withFileTypes: true })
        .map((f) =>
          f.isDirectory()
            ? { name: `${f.name}/`, bytes: 0 }
            : { name: f.name, bytes: fs.statSync(path.join(taskDir, f.name)).size }
        )

      // ข้อความของ checkEvidenceBudget ขึ้นต้นด้วยชื่อไฟล์ → ได้ path เต็ม เช่น core/CORE-2/CORE-2-tests.txt
      for (const v of checkEvidenceBudget(files)) {
        violations.push(`${rel}/${v}`)
      }
    }
  }

  return violations
}
