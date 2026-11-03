import { selectAffiliateToken } from "../attribute-order"

// AF-17 (spec 05 กฎ 41b, AC-49): token ของ cart ที่ว่าง/ไม่ใช่ string ถือว่า "ไม่มี" แล้ว fallback ไป order.metadata
describe("selectAffiliateToken", () => {
  it.each([
    ["cart '' + order T → T", { affiliate_token: "" }, { affiliate_token: "T" }, "T"],
    ["cart '  ' + order T → T", { affiliate_token: "  " }, { affiliate_token: "T" }, "T"],
    ["cart T1 + order T2 → T1", { affiliate_token: "T1" }, { affiliate_token: "T2" }, "T1"],
    ["cart missing + order '' → no token", undefined, { affiliate_token: "" }, undefined],
    ["cart 123 (not a string) + order T → T", { affiliate_token: 123 }, { affiliate_token: "T" }, "T"],
    ["cart null + order null → no token", null, null, undefined],
    ["cart missing + order '  ' → no token", {}, { affiliate_token: "  " }, undefined],
    ["cart missing + order T → T", null, { affiliate_token: "T" }, "T"],
  ])("%s", (_, cart, order, expected) => {
    expect(selectAffiliateToken(cart, order)).toBe(expected)
  })
})
