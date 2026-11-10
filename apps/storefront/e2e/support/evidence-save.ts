import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  EVIDENCE_MAX_FILES,
  EvidenceTarget,
  evidenceDir,
  evidenceFileName,
  planEvidenceWrite,
} from "./evidence-rules"

/** ไฟล์ spec ที่ warn เรื่องไม่ตั้ง evidenceTarget ไปแล้ว (ต่อ worker process) — กฎข้อ 77c */
export const warnedSpecFiles = new Set<string>()

/** path สัมพัทธ์ (คั่นด้วย /) → sha1 ของเนื้อไฟล์ ทุกไฟล์ใต้ `root` — ใช้ใน test ตรวจว่าไม่มีไฟล์ evidence เปลี่ยน */
export function snapshotFiles(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else
        out[path.relative(root, full).split(path.sep).join("/")] = crypto
          .createHash("sha1")
          .update(new Uint8Array(fs.readFileSync(full)))
          .digest("hex")
    }
  }
  walk(root)
  return out
}

/**
 * CORE-5c (กฎข้อ 67): เขียน PNG ลง docs/evidence/<feature>/<task-id>/ ของ `target` เท่านั้น
 * - ไม่เปิด E2E_SAVE_EVIDENCE หรือ spec ไม่ตั้ง evidenceTarget → ไม่เขียนอะไร (คืน null)
 * - CORE-5d (กฎข้อ 77): ไม่ตั้ง evidenceTarget → warn ครั้งเดียวต่อไฟล์ spec;
 *   โฟลเดอร์มี PNG ครบงบแล้ว → warn และไม่เขียน (รวมชื่อซ้ำ) แทน throw เพื่อไม่ทับรูปของ qa
 * - CORE-5b (กฎข้อ 12): ตรวจงบกับชุดไฟล์หลังเขียนก่อน เกินงบ → throw และไม่เขียนไฟล์
 * คืน path ที่เขียน
 */
export function saveEvidencePng({
  save,
  target,
  repoRoot,
  name,
  png,
  specFile,
}: {
  save: boolean
  target: EvidenceTarget | undefined
  repoRoot: string
  name: string
  png: Buffer
  specFile: string
}): string | null {
  const fileName = evidenceFileName(name)
  if (!save) return null
  if (!target) {
    if (!warnedSpecFiles.has(specFile)) {
      warnedSpecFiles.add(specFile)
      console.warn(
        `evidence: ${specFile} ไม่ได้ตั้ง evidenceTarget จึงไม่บันทึก PNG ลง docs/evidence`
      )
    }
    return null
  }

  const dir = evidenceDir(repoRoot, target)
  const existing = fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => ({
        name: f,
        bytes: fs.statSync(path.join(dir, f)).size,
      }))
    : []
  if (
    existing.filter((f) => f.name.endsWith(".png")).length >= EVIDENCE_MAX_FILES
  ) {
    console.warn(
      `evidence: ไม่บันทึก ${fileName} เพราะ ${dir} มี PNG ครบ ${EVIDENCE_MAX_FILES} รูปแล้ว`
    )
    return null
  }
  const violations = planEvidenceWrite(existing, {
    name: fileName,
    bytes: png.byteLength,
  })
  if (violations.length) {
    throw new Error(
      `evidence เกินงบใน ${dir}: ${violations.join(
        "; "
      )} — ใช้ locator.screenshot() หรือ clip ให้เล็กลง หรือลดจำนวนรูป`
    )
  }
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, fileName)
  fs.writeFileSync(file, new Uint8Array(png))
  return file
}
