import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  EvidenceTarget,
  evidenceDir,
  evidenceFileName,
  planEvidenceWrite,
} from "./evidence-rules"

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
 * - CORE-5b (กฎข้อ 12): ตรวจงบกับชุดไฟล์หลังเขียนก่อน เกินงบ → throw และไม่เขียนไฟล์
 * คืน path ที่เขียน
 */
export function saveEvidencePng({
  save,
  target,
  repoRoot,
  name,
  png,
}: {
  save: boolean
  target: EvidenceTarget | undefined
  repoRoot: string
  name: string
  png: Buffer
}): string | null {
  const fileName = evidenceFileName(name)
  if (!save || !target) return null

  const dir = evidenceDir(repoRoot, target)
  const existing = fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => ({
        name: f,
        bytes: fs.statSync(path.join(dir, f)).size,
      }))
    : []
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
