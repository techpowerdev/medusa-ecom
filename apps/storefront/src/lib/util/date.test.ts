import fs from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { formatDate, formatDateTime } from "./date"

// spec 01 กฎข้อ 42 / AC-78: วันที่ที่แสดงใช้เขตเวลาไทยเสมอ — server (UTC) กับ browser ได้ข้อความเดียวกัน
const AT = "2026-10-25T18:30:00Z" // = 26 ต.ค. 01:30 เวลาไทย
const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
})

describe("formatDate / formatDateTime (AC-78)", () => {
  it.each(["UTC", "America/New_York"])("TZ=%s → วันที่ 26 ต.ค. ตามเวลาไทย", (tz) => {
    process.env.TZ = tz
    // positive control: Date ตาม TZ ของเครื่องยังเป็นวันที่ 25 (ถ้าไม่ระบุ timeZone วันจะเพี้ยน)
    expect(new Date(AT).getDate()).toBe(25)
    expect(formatDate(AT)).toMatch(/^26 ต\.ค\. /)
    expect(formatDateTime(AT)).toMatch(/^26 ต\.ค\. .*01:30/)
  })

  it("ได้ข้อความเดียวกันทุก TZ", () => {
    process.env.TZ = "UTC"
    const utc = [formatDate(AT), formatDateTime(AT)]
    process.env.TZ = "America/New_York"
    expect([formatDate(AT), formatDateTime(AT)]).toEqual(utc)
  })
})

// grep: ทุกการจัดรูปแบบวันที่ใน src ผ่าน helper นี้ (ซึ่งระบุ timeZone: "Asia/Bangkok")
const SRC = path.resolve(__dirname, "../..")
const HELPER = path.resolve(__dirname, "date.ts")
const DATE_CALL = /\.toLocaleDateString\(|\.toLocaleTimeString\(|\.toLocaleString\(|\.toDateString\(|\.toTimeString\(|Intl\.DateTimeFormat\(/

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })

describe("ไม่มีการจัดรูปแบบวันที่นอก helper (AC-78 grep)", () => {
  it("helper ระบุ timeZone Asia/Bangkok", () => {
    expect(fs.readFileSync(HELPER, "utf8")).toContain('timeZone: "Asia/Bangkok"')
  })

  it("ไฟล์อื่นใน src ไม่เรียก toLocale*String / toDateString / Intl.DateTimeFormat เอง", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== HELPER)
      .flatMap((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
          .filter(({ line }) => DATE_CALL.test(line))
          .map(({ at, line }) => `${at} ${line.trim()}`)
      )
    expect(offenders).toEqual([])
  })
})
