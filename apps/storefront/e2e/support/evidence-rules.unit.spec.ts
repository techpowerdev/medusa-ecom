import { expect, test } from "@playwright/test"
import path from "node:path"

import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  checkEvidenceBudget,
  evidenceDir,
  evidenceFileName,
} from "./evidence-rules"

test.describe("evidence-rules", () => {
  test("evidenceDir ชี้ไปที่ docs/evidence/<feature>/<task-id>", () => {
    expect(evidenceDir("/repo", { feature: "core", taskId: "CORE-5" })).toBe(
      path.join("/repo", "docs", "evidence", "core", "CORE-5")
    )
  })

  test("evidenceDir ปฏิเสธ feature/task-id ที่ผิดรูปแบบ", () => {
    expect(() =>
      evidenceDir("/repo", { feature: "Core", taskId: "CORE-5" })
    ).toThrow()
    expect(() =>
      evidenceDir("/repo", { feature: "core", taskId: "core-5" })
    ).toThrow()
    expect(() =>
      evidenceDir("/repo", { feature: "../x", taskId: "CORE-5" })
    ).toThrow()
  })

  test("evidenceFileName รับเฉพาะ kebab-case และเติมนามสกุล .png", () => {
    expect(evidenceFileName("01-admin-login")).toBe("01-admin-login.png")
    expect(() => evidenceFileName("Admin Login")).toThrow()
    expect(() => evidenceFileName("shot.jpg")).toThrow()
    expect(() => evidenceFileName("../escape")).toThrow()
  })

  test("checkEvidenceBudget ผ่านเมื่ออยู่ในงบ", () => {
    expect(
      checkEvidenceBudget([
        { name: "REPORT.md", bytes: 10_000 },
        { name: "01-a.png", bytes: EVIDENCE_MAX_BYTES },
      ])
    ).toEqual([])
  })

  test("checkEvidenceBudget แจ้งเมื่อ PNG เกินจำนวน", () => {
    const files = Array.from({ length: EVIDENCE_MAX_FILES + 1 }, (_, i) => ({
      name: `0${i}-shot.png`,
      bytes: 1000,
    }))
    expect(checkEvidenceBudget(files)).toEqual([
      expect.stringContaining(`${EVIDENCE_MAX_FILES + 1} PNG`),
    ])
  })

  test("checkEvidenceBudget แจ้งเมื่อไฟล์ใหญ่เกิน 300KB หรือไม่ใช่ไฟล์ที่อนุญาต", () => {
    expect(
      checkEvidenceBudget([
        { name: "big.png", bytes: EVIDENCE_MAX_BYTES + 1 },
        { name: "photo.jpg", bytes: 10 },
        { name: "trace.zip", bytes: 10 },
      ])
    ).toEqual([
      expect.stringContaining("big.png"),
      expect.stringContaining("photo.jpg"),
      expect.stringContaining("trace.zip"),
    ])
  })
})
