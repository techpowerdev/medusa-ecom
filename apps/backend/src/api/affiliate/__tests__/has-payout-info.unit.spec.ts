import { hasPayoutInfo } from "../helpers"

// AF-13 กฎ 34: true เมื่อ payout_info เป็น object ที่มีอย่างน้อย 1 key
describe("hasPayoutInfo (AF-13, rule 34)", () => {
  it.each([
    [{ bank_name: "x" }, true],
    [{ bank_name: "x", account_name: "Ann", account_number: "123" }, true],
    [{}, false],
    [null, false],
    [undefined, false],
    [[], false],
    ["text", false],
  ])("%p → %p", (payoutInfo, expected) => {
    expect(hasPayoutInfo(payoutInfo)).toBe(expected)
  })
})
