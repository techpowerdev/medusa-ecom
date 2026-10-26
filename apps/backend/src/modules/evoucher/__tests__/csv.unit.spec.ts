import { normalizeCode, parseEvoucherCsv } from "../utils/csv"

describe("parseEvoucherCsv", () => {
  it("parses code,pin,expires_at with a header row", () => {
    const rows = parseEvoucherCsv(
      "code,pin,expires_at\nLOTUS-1,1234,2027-01-31\nLOTUS-2,,\n"
    )
    expect(rows).toEqual([
      {
        code: "LOTUS-1",
        pin: "1234",
        expires_at: new Date("2027-01-31T23:59:59.999+07:00"),
      },
      { code: "LOTUS-2" },
    ])
  })

  it("accepts a code-only file without a header, CRLF, BOM and blank lines", () => {
    const rows = parseEvoucherCsv("﻿A1\r\n\r\nA2\r\n")
    expect(rows).toEqual([{ code: "A1" }, { code: "A2" }])
  })

  it("maps header columns by name in any order", () => {
    const rows = parseEvoucherCsv("expires_at,code\n2027-02-01T00:00:00Z,B1\n")
    expect(rows).toEqual([
      { code: "B1", expires_at: new Date("2027-02-01T00:00:00Z") },
    ])
  })

  // AC-12 (EV-8, owner Q4): วันที่ล้วน = ใช้ได้ถึงสิ้นวันนั้นตามเวลาไทย
  it("AC-12 treats a date-only expires_at as end of that day in Thai time", () => {
    const [row] = parseEvoucherCsv("code,expires_at\nF1,2026-12-31\n")
    expect(row.expires_at!.toISOString()).toBe("2026-12-31T16:59:59.999Z")
  })

  it("AC-12 keeps an ISO timestamp with an offset as given", () => {
    const rows = parseEvoucherCsv(
      "code,expires_at\nG1,2026-12-31T10:00:00+07:00\nG2,2026-12-31T00:00:00Z\n"
    )
    expect(rows.map((r) => r.expires_at!.toISOString())).toEqual([
      "2026-12-31T03:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
    ])
  })

  it("trims cells and supports quoted fields", () => {
    const rows = parseEvoucherCsv('  C1  , " 99 "\n"C,2",""\n')
    expect(rows).toEqual([{ code: "C1", pin: "99" }, { code: "C,2" }])
  })

  it("keeps duplicates (deduplication is the workflow's job)", () => {
    expect(parseEvoucherCsv("D1\nD1\n")).toHaveLength(2)
  })

  it("rejects rows with an empty code or invalid expires_at, citing line numbers", () => {
    expect(() =>
      parseEvoucherCsv("code,expires_at\n,2027-01-01\nE2,31/01/2027\n")
    ).toThrow(/line 2.*line 3/s)
  })

  it.each(["2026-02-30", "2026-04-31", "2026-13-01", "2026-02-30T10:00:00+07:00", "2026-00-10"])(
    "AC-22 rejects a non-existent calendar date %s instead of rolling it over",
    (value) => {
      expect(() => parseEvoucherCsv(`code,expires_at\nOK-1,2027-01-01\nBAD-1,${value}\n`)).toThrow(
        /line 3/
      )
    }
  )

  it("AC-22 accepts a real leap day", () => {
    expect(parseEvoucherCsv("LEAP-1,,2028-02-29\n")[0].expires_at?.toISOString()).toBe(
      "2028-02-29T16:59:59.999Z"
    )
  })

  it("rejects a header without a code column", () => {
    expect(() => parseEvoucherCsv("pin,expires_at\n1,2027-01-01\n")).toThrow(
      /code/
    )
  })

  it("rejects a file without any code", () => {
    expect(() => parseEvoucherCsv("code,pin\n\n")).toThrow(/no codes/i)
  })
})

describe("normalizeCode", () => {
  it("trims surrounding whitespace but keeps case and inner characters", () => {
    expect(normalizeCode("  Ab-12 cd\t")).toBe("Ab-12 cd")
  })
})
