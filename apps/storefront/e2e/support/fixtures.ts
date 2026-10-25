import { test as base, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import {
  EVIDENCE_MAX_BYTES,
  EvidenceTarget,
  checkEvidenceBudget,
  evidenceDir,
  evidenceFileName,
} from "./evidence-rules"
import { REPO_ROOT } from "./paths"

export const BACKEND_URL =
  process.env.E2E_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000"

const SAVE_EVIDENCE = process.env.E2E_SAVE_EVIDENCE === "1"

type Fixtures = {
  /** test.step ที่แนบ screenshot ของ page หลังจบ step เสมอ (รวมกรณี fail) ลงใน HTML report */
  step: (title: string, body: () => Promise<void>) => Promise<void>
  /**
   * screenshot สำคัญ: แนบใน report เสมอ และเขียนลง docs/evidence/<feature>/<task-id>/<name>.png
   * เมื่อรันด้วย E2E_SAVE_EVIDENCE=1 (ตรวจงบ ≤5 รูป, ≤300KB)
   */
  evidence: (name: string) => Promise<void>
}

type Options = { evidenceTarget: EvidenceTarget | undefined }

export const test = base.extend<Fixtures & Options>({
  evidenceTarget: [undefined, { option: true }],

  step: async ({ page }, provide, testInfo) => {
    let n = 0
    await provide(async (title, body) => {
      const index = String(++n).padStart(2, "0")
      await base.step(title, async () => {
        try {
          await body()
        } finally {
          if (page.url() !== "about:blank") {
            await testInfo.attach(`step-${index} ${title}`, {
              body: await page.screenshot(),
              contentType: "image/png",
            })
          }
        }
      })
    })
  },

  evidence: async ({ page, evidenceTarget }, provide, testInfo) => {
    await provide(async (name) => {
      const fileName = evidenceFileName(name)
      const png = await page.screenshot()
      await testInfo.attach(`evidence ${fileName}`, {
        body: png,
        contentType: "image/png",
      })
      if (!SAVE_EVIDENCE) return

      if (!evidenceTarget) {
        throw new Error(
          "ต้องตั้ง test.use({ evidenceTarget: { feature, taskId } }) ก่อนบันทึก evidence"
        )
      }
      if (png.byteLength > EVIDENCE_MAX_BYTES) {
        throw new Error(
          `${fileName} ขนาด ${png.byteLength} bytes เกิน ${EVIDENCE_MAX_BYTES} — ใช้ locator.screenshot() หรือ clip ให้เล็กลง`
        )
      }
      const dir = evidenceDir(REPO_ROOT, evidenceTarget)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, fileName), new Uint8Array(png))

      const files = fs.readdirSync(dir).map((f) => ({
        name: f,
        bytes: fs.statSync(path.join(dir, f)).size,
      }))
      const violations = checkEvidenceBudget(files)
      if (violations.length) {
        throw new Error(`evidence เกินงบใน ${dir}: ${violations.join("; ")}`)
      }
    })
  },
})

export { expect }
