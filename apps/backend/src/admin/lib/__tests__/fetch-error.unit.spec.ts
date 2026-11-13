import { FetchError } from "@medusajs/js-sdk"
import { isUnauthorized } from "../fetch-error"

// spec 08 กฎ 24b/25 (ADM-20, ADM-21a): query รายการล้มด้วย 401 → throw ให้ ErrorBoundary ของ dashboard พาไป /login
describe("isUnauthorized", () => {
  it("true เฉพาะ FetchError ที่ status 401", () => {
    expect(isUnauthorized(new FetchError("Unauthorized", "Unauthorized", 401))).toBe(true)
  })

  it.each([
    ["FetchError 500", new FetchError("boom", "Internal Server Error", 500)],
    ["FetchError 403", new FetchError("forbidden", "Forbidden", 403)],
    ["network error (TypeError)", new TypeError("Failed to fetch")],
    ["Error ที่มี status 401 แต่ไม่ใช่ FetchError", Object.assign(new Error("x"), { status: 401 })],
    ["null", null],
    ["undefined", undefined],
  ])("false: %s", (_name, error) => {
    expect(isUnauthorized(error)).toBe(false)
  })
})
