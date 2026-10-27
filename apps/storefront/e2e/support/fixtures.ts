import { test as base, expect } from "@playwright/test"

import { EvidenceTarget, evidenceFileName } from "./evidence-rules"
import { saveEvidencePng } from "./evidence-save"
import { REPO_ROOT } from "./paths"

export const BACKEND_URL =
  process.env.E2E_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000"

type Fixtures = {
  /** test.step ที่แนบ screenshot ของ page หลังจบ step เสมอ (รวมกรณี fail) ลงใน HTML report เท่านั้น ไม่เขียนลง docs/evidence */
  step: (title: string, body: () => Promise<void>) => Promise<void>
  /**
   * screenshot สำคัญ: แนบใน report เสมอ และเขียนลง docs/evidence/<feature>/<task-id>/<name>.png
   * เมื่อรันด้วย E2E_SAVE_EVIDENCE=1 และ spec ตั้ง evidenceTarget (ตรวจงบ ≤5 รูป, ≤300KB)
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
      // CORE-5c: อ่าน env ตอนเรียก และเขียนได้เฉพาะโฟลเดอร์ของ evidenceTarget (ไม่ตั้ง → ไม่เขียน)
      saveEvidencePng({
        save: process.env.E2E_SAVE_EVIDENCE === "1",
        target: evidenceTarget,
        repoRoot: REPO_ROOT,
        name,
        png,
      })
    })
  },
})

export { expect }
