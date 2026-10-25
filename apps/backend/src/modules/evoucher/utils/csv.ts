import { MedusaError } from "@medusajs/framework/utils"

export type ParsedEvoucherRow = {
  code: string
  pin?: string
  expires_at?: Date
}

const COLUMNS = ["code", "pin", "expires_at"] as const
type Column = (typeof COLUMNS)[number]

/**
 * Normalize ก่อนเข้ารหัส/เทียบซ้ำ: trim เท่านั้น (คง case และอักขระภายในตามที่พาร์ทเนอร์ให้มา
 * เพราะเราส่ง code นี้ให้ลูกค้าตรงตัว) — ดู Q4 ใน PR EV-2 เรื่อง case sensitivity
 */
export const normalizeCode = (value: string) => value.trim()

// owner Q4 (AC-12): วันที่ล้วน = ใช้ได้ถึงสิ้นวันนั้นตามเวลาไทย (+07:00); ค่าที่มีเวลา/offset ใช้ตามจริง
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const parseExpiresAt = (value: string) =>
  DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999+07:00`) : new Date(value)

// แยก 1 บรรทัด CSV (รองรับ "quoted", "" escape); ไม่รองรับ newline ภายใน quote
function splitLine(line: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true
      cell = ""
    } else if (ch === ",") {
      cells.push(cell)
      cell = ""
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/** CSV ของพาร์ทเนอร์: `code,pin?,expires_at?` (header optional) — ล้มทั้งไฟล์ถ้ามีแถวผิด */
export function parseEvoucherCsv(content: string): ParsedEvoucherRow[] {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/)
  let columns: Column[] = [...COLUMNS]
  let start = 0

  const first = lines.findIndex((l) => l.trim() !== "")
  if (first >= 0) {
    const header = splitLine(lines[first]).map((c) => c.toLowerCase())
    if (header.some((c) => (COLUMNS as readonly string[]).includes(c))) {
      if (!header.includes("code")) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "CSV header must contain a `code` column"
        )
      }
      columns = header as Column[]
      start = first + 1
    }
  }

  const rows: ParsedEvoucherRow[] = []
  const errors: string[] = []
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      continue
    }
    const cells = splitLine(lines[i])
    const get = (col: Column) => cells[columns.indexOf(col)] || undefined
    const code = get("code")
    const pin = get("pin")
    const expires = get("expires_at")
    const lineNo = i + 1

    if (!code) {
      errors.push(`line ${lineNo}: code is empty`)
      continue
    }
    const row: ParsedEvoucherRow = { code: normalizeCode(code) }
    if (pin) {
      row.pin = pin
    }
    if (expires) {
      const date = /^\d{4}-\d{2}-\d{2}/.test(expires) ? parseExpiresAt(expires) : null
      if (!date || isNaN(date.getTime())) {
        errors.push(`line ${lineNo}: expires_at must be ISO 8601 (YYYY-MM-DD)`)
        continue
      }
      row.expires_at = date
    }
    rows.push(row)
  }

  if (errors.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid CSV: ${errors.slice(0, 20).join("; ")}`
    )
  }
  if (!rows.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "CSV has no codes")
  }
  return rows
}
