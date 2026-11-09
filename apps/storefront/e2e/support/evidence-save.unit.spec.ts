import { expect, test } from "@playwright/test"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES } from "./evidence-rules"
import {
  saveEvidencePng,
  snapshotFiles,
  warnedSpecFiles,
} from "./evidence-save"

// CORE-5c AC-103 (กฎข้อ 67): evidence เขียนได้เฉพาะโฟลเดอร์ของ evidenceTarget,
// spec ที่ไม่ตั้ง evidenceTarget ไม่เขียนไฟล์ และไม่แตะโฟลเดอร์ของ task อื่น
const png = Buffer.from("png")
const core22 = { feature: "core", taskId: "CORE-22" }
const specFile = "x.spec.ts"
const originalWarn = console.warn

let repoRoot: string
let evidenceRoot: string
let warnings: string[]

test.beforeEach(() => {
  warnings = []
  console.warn = (...args: unknown[]) => {
    warnings.push(args.join(" "))
  }
  warnedSpecFiles.clear()
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
  console.warn = originalWarn
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
        specFile,
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
        specFile,
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
      specFile,
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
})

// CORE-5d AC-115 (กฎข้อ 77): โฟลเดอร์ที่มี PNG ครบงบแล้ว → ไม่เขียนและ warn แทน throw
test.describe("saveEvidencePng (CORE-5d, AC-115)", () => {
  const core22Dir = () => path.join(evidenceRoot, "core", "CORE-22")
  const pngCount = () =>
    fs.readdirSync(core22Dir()).filter((f) => f.endsWith(".png")).length
  const saveToCore22 = (name: string, body: Buffer = png) =>
    saveEvidencePng({
      save: true,
      target: core22,
      repoRoot,
      name,
      png: body,
      specFile,
    })

  test("(a) PNG ครบ 5 + ชื่อใหม่ → คืน null ไม่เขียน และ warn 1 ครั้ง", () => {
    const before = snapshotFiles(evidenceRoot)
    expect(saveToCore22("01-order-detail-title")).toBeNull()
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("01-order-detail-title.png")
    expect(warnings[0]).toContain("CORE-22")
  })

  test("(b) PNG ครบ 5 + ชื่อซ้ำ เนื้อต่าง → ไม่เขียนทับ และ warn 1 ครั้ง", () => {
    const before = snapshotFiles(evidenceRoot)
    expect(saveToCore22("qa-01", Buffer.from("other"))).toBeNull()
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
    expect(snapshotFiles(evidenceRoot)["core/CORE-22/qa-01.png"]).toBe(
      before["core/CORE-22/qa-01.png"]
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("qa-01.png")
    expect(warnings[0]).toContain("CORE-22")
  })

  test("(d) PNG 4 รูป: ชื่อใหม่ครั้งแรกเขียนได้ ครั้งถัดไปไม่เขียนและ warn", () => {
    fs.rmSync(path.join(core22Dir(), "qa-05.png"))
    expect(saveToCore22("01-new")).toBe(path.join(core22Dir(), "01-new.png"))
    expect(warnings).toHaveLength(0)
    expect(pngCount()).toBe(5)

    expect(saveToCore22("02-new")).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(pngCount()).toBe(5)
    expect(fs.existsSync(path.join(core22Dir(), "02-new.png"))).toBe(false)
  })

  test("(e) PNG เกิน 300KB: โฟลเดอร์ครบ 5 → warn ไม่ throw; โฟลเดอร์ < 5 → ยัง throw", () => {
    const oversized = Buffer.alloc(EVIDENCE_MAX_BYTES + 1)
    expect(saveToCore22("01-big", oversized)).toBeNull()
    expect(warnings).toHaveLength(1)

    fs.rmSync(path.join(core22Dir(), "qa-05.png"))
    const before = snapshotFiles(evidenceRoot)
    expect(() => saveToCore22("01-big", oversized)).toThrow(/เกินงบ/)
    expect(snapshotFiles(evidenceRoot)).toEqual(before)
    expect(warnings).toHaveLength(1)
  })

  test("(f) ไม่มี evidenceTarget → warn 1 ครั้งต่อไฟล์ spec และไม่เขียน", () => {
    const before = snapshotFiles(evidenceRoot)
    const save = (file: string) =>
      saveEvidencePng({
        save: true,
        target: undefined,
        repoRoot,
        name: "01-x",
        png,
        specFile: file,
      })
    expect(save("a.spec.ts")).toBeNull()
    expect(save("a.spec.ts")).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("a.spec.ts")
    expect(snapshotFiles(evidenceRoot)).toEqual(before)

    expect(save("b.spec.ts")).toBeNull()
    expect(warnings).toHaveLength(2)
    expect(warnings[1]).toContain("b.spec.ts")
  })

  test("(g) ไม่เปิด E2E_SAVE_EVIDENCE → ไม่ warn ทั้งโฟลเดอร์ครบ 5 และไม่มี target", () => {
    for (const target of [core22, undefined]) {
      expect(
        saveEvidencePng({
          save: false,
          target,
          repoRoot,
          name: "01-x",
          png,
          specFile,
        })
      ).toBeNull()
    }
    expect(warnings).toHaveLength(0)
  })

  test("กฎข้อ 77b: PNG < 5 รูป เขียนทับชื่อซ้ำได้ และไฟล์ต้องห้ามยัง throw", () => {
    fs.rmSync(path.join(core22Dir(), "qa-05.png"))
    expect(saveToCore22("qa-01", Buffer.from("new"))).toBe(
      path.join(core22Dir(), "qa-01.png")
    )
    expect(fs.readFileSync(path.join(core22Dir(), "qa-01.png"), "utf8")).toBe(
      "new"
    )
    expect(warnings).toHaveLength(0)

    fs.writeFileSync(path.join(core22Dir(), "trace.zip"), "x")
    expect(() => saveToCore22("01-new")).toThrow(/เกินงบ/)
  })

  test("static: fixtures.ts ส่ง specFile จาก testInfo.file", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "fixtures.ts"),
      "utf8"
    )
    expect(source).toMatch(/specFile:\s*testInfo\.file/)
  })
})
