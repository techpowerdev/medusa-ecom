import { normalizeEmail } from "../normalize-email"

// CORE-80 (spec 01 กฎข้อ 138, AC-179): อีเมลเทียบแบบไม่สนตัวพิมพ์ — `entity_id` ของ emailpass เป็น case-sensitive
describe("normalizeEmail", () => {
  it.each([
    ["Foo.Bar@Example.COM", "foo.bar@example.com"],
    ["  A@B.CO \n", "a@b.co"],
    ["already@lower.co", "already@lower.co"],
    ["", ""],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected)
  })
})
