import { INT4_MAX } from "../int4"

// GB-17 (spec 04 กฎข้อ 40): เพดานของ column `integer` (int4) ของ Postgres
describe("INT4_MAX", () => {
  it("equals the largest Postgres integer (2^31 - 1)", () => {
    expect(INT4_MAX).toBe(2147483647)
  })
})
