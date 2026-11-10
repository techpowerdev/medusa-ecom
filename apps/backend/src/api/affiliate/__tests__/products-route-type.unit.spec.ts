import { readFileSync } from "node:fs"
import { join } from "node:path"

// AF-N2 (กฎ 32d, AC-38): type Program ของ /affiliate/products ระบุ field ไม่ใช้ Record<string, unknown>
describe("affiliate products route Program type", () => {
  it("does not widen Program with Record<string, unknown>", () => {
    const source = readFileSync(join(__dirname, "../products/route.ts"), "utf8")

    expect(source).not.toContain("Record<string, unknown>")
  })
})
