import { expect, test } from "@playwright/test"
import path from "node:path"

import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  checkEvidenceBudget,
  checkFeatureEntries,
  evidenceDir,
  evidenceFileName,
  planEvidenceWrite,
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

  // CORE-5b AC-20: task id มี suffix ตัวเล็กได้หนึ่งตัว
  test("evidenceDir รับ task id ที่มี suffix ตัวเล็ก (AC-20)", () => {
    for (const taskId of ["CORE-4a", "CORE-5b", "CORE-5", "GB-12"]) {
      expect(evidenceDir("/repo", { feature: "core", taskId })).toBe(
        path.join("/repo", "docs", "evidence", "core", taskId)
      )
    }
  })

  test("evidenceDir ปฏิเสธ task id ผิดรูปแบบ (AC-20)", () => {
    for (const taskId of ["core-4a", "CORE4", "CORE-4ab", "CORE-", "CORE-4A"]) {
      expect(() => evidenceDir("/repo", { feature: "core", taskId })).toThrow()
    }
  })

  // CORE-5b AC-21: ตรวจงบกับชุดไฟล์หลังเขียน ก่อนเขียนจริง
  const fivePngs = Array.from({ length: EVIDENCE_MAX_FILES }, (_, i) => ({
    name: `0${i + 1}-existing.png`,
    bytes: 1000,
  }))

  test("planEvidenceWrite ปฏิเสธรูปที่ 6 (AC-21)", () => {
    expect(
      planEvidenceWrite(fivePngs, { name: "06-new.png", bytes: 1000 })
    ).toEqual([expect.stringContaining(`${EVIDENCE_MAX_FILES + 1} PNG`)])
  })

  test("planEvidenceWrite ให้เขียนทับชื่อเดิมได้โดยไม่นับเป็นรูปใหม่ (AC-21)", () => {
    expect(
      planEvidenceWrite(fivePngs, { name: "01-existing.png", bytes: 2000 })
    ).toEqual([])
  })

  test("planEvidenceWrite ปฏิเสธ PNG ใหม่ที่เกิน 300KB (AC-21)", () => {
    expect(
      planEvidenceWrite([], { name: "01-big.png", bytes: EVIDENCE_MAX_BYTES + 1 })
    ).toEqual([expect.stringContaining("01-big.png")])
  })

  test("planEvidenceWrite ใช้ขนาดใหม่เมื่อเขียนทับไฟล์ชื่อเดิม (AC-21)", () => {
    expect(
      planEvidenceWrite([{ name: "01-a.png", bytes: EVIDENCE_MAX_BYTES + 1 }], {
        name: "01-a.png",
        bytes: 10,
      })
    ).toEqual([])
  })

  // CORE-5b AC-22: ระดับ feature อนุญาตเฉพาะ <TASK-ID>-tests.txt และโฟลเดอร์ <TASK-ID>/
  test("checkFeatureEntries ผ่านเมื่อมีเฉพาะ <TASK-ID>-tests.txt และโฟลเดอร์ <TASK-ID>/ (AC-22)", () => {
    expect(
      checkFeatureEntries([
        { name: "CORE-5-tests.txt", isDirectory: false },
        { name: "CORE-4a-tests.txt", isDirectory: false },
        { name: "CORE-5", isDirectory: true },
        { name: "CORE-4a", isDirectory: true },
      ])
    ).toEqual([])
  })

  test("checkFeatureEntries แจ้งไฟล์/โฟลเดอร์ที่ไม่ตรง convention (AC-22)", () => {
    expect(
      checkFeatureEntries([
        { name: "x.png", isDirectory: false },
        { name: "CORE-5.txt", isDirectory: false },
        { name: "core-5-tests.txt", isDirectory: false },
        { name: "screens", isDirectory: true },
      ])
    ).toEqual([
      expect.stringContaining("x.png"),
      expect.stringContaining("CORE-5.txt"),
      expect.stringContaining("core-5-tests.txt"),
      expect.stringContaining("screens/"),
    ])
  })

  test("checkEvidenceBudget แนะนำให้ย้าย *-tests.txt ที่อยู่ในโฟลเดอร์ task (AC-22)", () => {
    expect(checkEvidenceBudget([{ name: "CORE-2-tests.txt", bytes: 10 }])).toEqual(
      [expect.stringContaining("ย้าย")]
    )
  })
})
