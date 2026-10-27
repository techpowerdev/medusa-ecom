import { expect, test } from "@playwright/test"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { EVIDENCE_MAX_FILES } from "./evidence-rules"
import { saveEvidencePng, snapshotFiles } from "./evidence-save"

// CORE-5c AC-103 (กฎข้อ 67): evidence เขียนได้เฉพาะโฟลเดอร์ของ evidenceTarget,
// spec ที่ไม่ตั้ง evidenceTarget ไม่เขียนไฟล์ และไม่แตะโฟลเดอร์ของ task อื่น
const png = Buffer.from("png")

let repoRoot: string
let evidenceRoot: string

test.beforeEach(() => {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "core-5c-"))
  evidenceRoot = path.join(repoRoot, "docs", "evidence")
  const core22 = path.join(evidenceRoot, "core", "CORE-22")
  fs.mkdirSync(core22, { recursive: true })
  fs.writeFileSync(path.join(core22, "REPORT.md"), "qa")
  for (let i = 1; i <= EVIDENCE_MAX_FILES; i++) {
    fs.writeFileSync(path.join(core22, `qa-0${i}.png`), "qa")
  }
})

test.afterEach(() => {
  fs.rmSync(repoRoot, { recursive: true, force: true })
})

test.describe("saveEvidencePng (CORE-5c, AC-103)", () => {
  test("ไม่ตั้ง evidenceTarget → ไม่เขียนไฟล์และไม่ throw แม้ E2E_SAVE_EVIDENCE=1", () => {
    const before = snapshotFiles(evidenceRoot)
    expect(
      saveEvidencePng({
        save: true,
        target: undefined,
        repoRoot,
        name: "01-x",
        png,
      })
    ).toBeNull()
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
  })

  test("ไม่ได้เปิด E2E_SAVE_EVIDENCE → ไม่เขียนไฟล์", () => {
    const before = snapshotFiles(evidenceRoot)
    expect(
      saveEvidencePng({
        save: false,
        target: { feature: "core", taskId: "CORE-23" },
        repoRoot,
        name: "01-x",
        png,
      })
    ).toBeNull()
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
  })

  test("เขียนเฉพาะในโฟลเดอร์ของ evidenceTarget — โฟลเดอร์ task อื่นไม่เปลี่ยน", () => {
    const before = snapshotFiles(evidenceRoot)
    const written = saveEvidencePng({
      save: true,
      target: { feature: "core", taskId: "CORE-23" },
      repoRoot,
      name: "01-phone-cleared",
      png,
    })
    expect(written).toBe(
      path.join(evidenceRoot, "core", "CORE-23", "01-phone-cleared.png")
    )
    expect(snapshotFiles(evidenceRoot)).toEqual({
      ...before,
      "core/CORE-23/01-phone-cleared.png": crypto
        .createHash("sha1")
        .update(new Uint8Array(png))
        .digest("hex"),
    })
  })

  test("โฟลเดอร์ปลายทางมี PNG ครบงบแล้ว → throw และ PNG ยังไม่เกิน 5", () => {
    const before = snapshotFiles(evidenceRoot)
    expect(() =>
      saveEvidencePng({
        save: true,
        target: { feature: "core", taskId: "CORE-22" },
        repoRoot,
        name: "01-order-detail-title",
        png,
      })
    ).toThrow(/เกินงบ/)
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
  })
})
