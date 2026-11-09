import { affiliateAction, parsePayoutInfo, payoutInfoForm } from "../affiliate-account"

// AF-12b (spec 05 กฎ 37b): ปุ่มตามสถานะ affiliate และ validator ของฟอร์มข้อมูลรับเงิน 3 ช่อง
describe("affiliateAction", () => {
  it("maps each status to its single action and target status", () => {
    expect(affiliateAction("pending")).toEqual({ label: "Approve", status: "active", confirm: false })
    expect(affiliateAction("active")).toEqual({ label: "Suspend", status: "suspended", confirm: true })
    expect(affiliateAction("suspended")).toEqual({
      label: "Reactivate",
      status: "active",
      confirm: false,
    })
  })
})

describe("parsePayoutInfo", () => {
  it("trims the three fields, strips - and spaces from account_number and returns only those keys", () => {
    expect(
      parsePayoutInfo({ bank_name: "  KBank ", account_name: " Ann A. ", account_number: " 123-4-56789-0 " }),
    ).toEqual({
      ok: true,
      value: { bank_name: "KBank", account_name: "Ann A.", account_number: "1234567890" },
    })
    expect(parsePayoutInfo({ bank_name: "K", account_name: "A", account_number: "123 456 789 012" })).toEqual({
      ok: true,
      value: { bank_name: "K", account_name: "A", account_number: "123456789012" },
    })
  })

  // AF-15 (กฎ 39a, owner Q20): ตัด - และช่องว่างแล้วต้องเป็นตัวเลข 10–12 หลัก — แบบเดียวกับ validator ของ API
  it.each(["123-456-789", "1234567890123", "123456789A"])("rejects account_number %p", (account_number) => {
    expect(parsePayoutInfo({ bank_name: "K", account_name: "A", account_number })).toEqual({
      ok: false,
      errors: { account_number: "Must be 10–12 digits" },
    })
  })

  it("requires every field after trimming", () => {
    expect(parsePayoutInfo({ bank_name: " ", account_name: "Ann", account_number: "" })).toEqual({
      ok: false,
      errors: { bank_name: "Required", account_number: "Required" },
    })
  })
})

describe("payoutInfoForm", () => {
  it("prefills from stored payout_info and falls back to empty strings", () => {
    expect(payoutInfoForm(null)).toEqual({ bank_name: "", account_name: "", account_number: "" })
    expect(payoutInfoForm({ bank_name: "SCB", account_number: 42, promptpay_id: "x" })).toEqual({
      bank_name: "SCB",
      account_name: "",
      account_number: "",
    })
  })
})
