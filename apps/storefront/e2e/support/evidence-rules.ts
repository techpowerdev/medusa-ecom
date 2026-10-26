import path from "node:path"

// กฎ evidence ตาม CLAUDE.md ข้อ 6: ใน git เก็บเฉพาะ REPORT.md + screenshot สำคัญ ≤5 รูป (PNG ≤300KB)
// report/trace เต็มของ Playwright เป็น CI artifact เท่านั้น
export const EVIDENCE_MAX_FILES = 5
export const EVIDENCE_MAX_BYTES = 300 * 1024

export type EvidenceTarget = { feature: string; taskId: string }
export type EvidenceFile = { name: string; bytes: number }

const FEATURE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// CORE-5b: รับ suffix ตัวเล็กหนึ่งตัว เช่น CORE-4a, CORE-5b; GB-6b1: ตามด้วยตัวเลขได้อีกหนึ่งหลัก (task ที่ spec แยกย่อย)
const TASK_ID_RE = /^[A-Z]+-\d+([a-z]\d?)?$/
const TESTS_TXT_RE = /^[A-Z]+-\d+([a-z]\d?)?-tests\.txt$/
const ALLOWED_NON_PNG = new Set(["REPORT.md"])

export function evidenceDir(repoRoot: string, target: EvidenceTarget): string {
  if (!FEATURE_RE.test(target.feature)) {
    throw new Error(`feature ต้องเป็น kebab-case ตัวเล็ก: "${target.feature}"`)
  }
  if (!TASK_ID_RE.test(target.taskId)) {
    throw new Error(
      `task id ต้องอยู่ในรูป XX-n, XX-na หรือ XX-nan เช่น CORE-5, CORE-4a, GB-6b1: "${target.taskId}"`
    )
  }
  return path.join(repoRoot, "docs", "evidence", target.feature, target.taskId)
}

export function evidenceFileName(name: string): string {
  if (!FEATURE_RE.test(name)) {
    throw new Error(
      `ชื่อ evidence ต้องเป็น kebab-case ไม่มีนามสกุล เช่น "01-admin-login": "${name}"`
    )
  }
  return `${name}.png`
}

export function checkEvidenceBudget(files: EvidenceFile[]): string[] {
  const violations: string[] = []
  const pngs = files.filter((f) => f.name.endsWith(".png"))

  if (pngs.length > EVIDENCE_MAX_FILES) {
    violations.push(`มี ${pngs.length} PNG เกินกำหนด ${EVIDENCE_MAX_FILES} รูป`)
  }
  for (const f of files) {
    if (f.name.endsWith(".png")) {
      if (f.bytes > EVIDENCE_MAX_BYTES) {
        violations.push(
          `${f.name} ขนาด ${f.bytes} bytes เกิน ${EVIDENCE_MAX_BYTES} bytes`
        )
      }
    } else if (TESTS_TXT_RE.test(f.name)) {
      violations.push(
        `${f.name} ต้องย้ายขึ้นไปไว้ที่ระดับ feature (docs/evidence/<feature>/${f.name})`
      )
    } else if (!ALLOWED_NON_PNG.has(f.name)) {
      violations.push(
        `${f.name} ไม่อนุญาตใน git (เก็บได้เฉพาะ REPORT.md และ PNG; report/trace เป็น CI artifact)`
      )
    }
  }
  return violations
}

/**
 * ตรวจงบกับชุดไฟล์ที่จะเกิดขึ้นหลังเขียน `incoming` ลงโฟลเดอร์ที่มี `existing` อยู่แล้ว
 * (เขียนทับชื่อเดิม = แทนที่ ไม่นับเป็นรูปใหม่) เรียกก่อนเขียนไฟล์จริงเสมอ
 */
export function planEvidenceWrite(
  existing: EvidenceFile[],
  incoming: EvidenceFile
): string[] {
  return checkEvidenceBudget([
    ...existing.filter((f) => f.name !== incoming.name),
    incoming,
  ])
}

export type EvidenceEntry = { name: string; isDirectory: boolean }

/** ระดับ docs/evidence/<feature>/ อนุญาตเฉพาะ <TASK-ID>-tests.txt และโฟลเดอร์ <TASK-ID>/ */
export function checkFeatureEntries(entries: EvidenceEntry[]): string[] {
  const violations: string[] = []
  for (const e of entries) {
    if (e.isDirectory) {
      if (!TASK_ID_RE.test(e.name)) {
        violations.push(`${e.name}/ ไม่ใช่โฟลเดอร์ <TASK-ID>/ (เช่น CORE-5/)`)
      }
    } else if (!TESTS_TXT_RE.test(e.name)) {
      violations.push(
        `${e.name} ไม่อนุญาตที่ระดับ feature (เก็บได้เฉพาะ <TASK-ID>-tests.txt)`
      )
    }
  }
  return violations
}
