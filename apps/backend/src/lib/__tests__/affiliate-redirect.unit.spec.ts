import { safeRedirectPath } from "../affiliate-redirect"

// AF-2: `GET /store/affiliate/r/:code?to=` redirect ได้เฉพาะ path ภายในร้าน (กัน open redirect)
describe("safeRedirectPath (AF-2)", () => {
  it.each([
    ["/products/t-shirt", "/products/t-shirt"],
    ["/products/t-shirt?variant=1#top", "/products/t-shirt?variant=1#top"],
    ["/", "/"],
  ])("keeps an internal path %p", (to, expected) => {
    expect(safeRedirectPath(to)).toBe(expected)
  })

  it.each([
    undefined,
    "",
    "products/t-shirt",
    "https://evil.example",
    "//evil.example/x",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    ["/a", "/b"],
    42,
  ])("falls back to / for %p", (to) => {
    expect(safeRedirectPath(to)).toBe("/")
  })
})
