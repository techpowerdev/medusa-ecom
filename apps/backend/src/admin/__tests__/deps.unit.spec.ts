// spec 08 AC-1 (ADM-1, กฎ 2–3): dependency ของ admin ต้องตรงกับที่ @medusajs/dashboard ใช้ (pin exact)
// เพื่อให้ bundle มี @medusajs/ui สำเนาเดียว และ import ของจาก dashboard ได้โดยไม่ชนเวอร์ชัน
import backendPkg from "../../../package.json"

const dashboardPkg = require("@medusajs/dashboard/package.json") as {
  dependencies: Record<string, string>
}

const SHARED_DEPS = [
  "@medusajs/ui",
  "@medusajs/icons",
  "react-hook-form",
  "@hookform/resolvers",
  "zod",
  "@tanstack/react-query",
  "react-router-dom",
] as const

describe("admin dependencies (spec 08 AC-1)", () => {
  const ours = backendPkg.dependencies as Record<string, string | undefined>

  it.each(SHARED_DEPS)("%s ตรงกับ dependency ของ @medusajs/dashboard แบบ exact", (name) => {
    const expected = dashboardPkg.dependencies[name]
    expect(expected).toMatch(/^\d+\.\d+\.\d+$/)
    expect(ours[name]).toBe(expected)
  })

  it("jest โหลด @medusajs/dashboard/lib ได้ (กฎ 2)", async () => {
    const lib = await import("@medusajs/dashboard/lib")
    expect(lib.optionalInt.safeParse("2").success).toBe(true)
    expect(typeof lib.getLocaleAmount).toBe("function")
  })
})
