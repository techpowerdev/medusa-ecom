import { maskSecret } from "../utils/mask"

describe("maskSecret", () => {
  it("shows only the last 4 characters of long codes", () => {
    expect(maskSecret("LOTUS-12345678")).toBe("**********5678")
  })

  it("fully masks short codes so most of the code is never exposed", () => {
    expect(maskSecret("1234567")).toBe("*******")
  })

  it("never returns the plaintext", () => {
    for (const value of ["ABCDEFGH", "X", "LONG-CODE-0001"]) {
      expect(maskSecret(value)).not.toBe(value)
    }
  })
})
