import { affiliateAction, parsePayoutInfo, payoutInfoForm } from "../affiliate-account"

// AF-12b (spec 05 กฎ 37b): ปุ่มตามสถานะ affiliate และ validator ของฟอร์มข้อมูลรับเงิน 3 ช่อง
describe("affiliateAction", () => {
  it("maps each status to its single action and target status", () => {
    expect(affiliateAction("pending")).toEqual({ testId: "affiliate-approve", label: "Approve", status: "active", confirm: false })
    expect(affiliateAction("active")).toEqual({ testId: "affiliate-suspend", label: "Suspend", status: "suspended", confirm: true })
    expect(affiliateAction("suspended")).toEqual({
      testId: "affiliate-reactivate",
      label: "Reactivate",
      status: "active",
      confirm: false,
    })
  })
})

describe("parsePayoutInfo", () => {
  it("trims the three fields and returns only those keys", () => {
    expect(
      parsePayoutInfo({ bank_name: "  KBank ", account_name: " Ann A. ", account_number: " 123-4-56789-0 " }),
    ).toEqual({
      ok: true,
      value: { bank_name: "KBank", account_name: "Ann A.", account_number: "123-4-56789-0" },
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
