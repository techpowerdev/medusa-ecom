import { affiliateAction, payoutInfoForm, payoutInfoSchema } from "../affiliate-account"

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

// ADM-9 (ADR-018 แถว 27): validator ของ drawer เป็น schema zod — ผลลัพธ์ต่อช่องเท่าเดิม
describe("payoutInfoSchema", () => {
  const errorsOf = (input: Record<string, string>) => {
    const result = payoutInfoSchema.safeParse(input)
    return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]))
  }

  it("trims the three fields, strips - and spaces from account_number and returns only those keys", () => {
    expect(
      payoutInfoSchema.parse({
        bank_name: "  KBank ",
        account_name: " Ann A. ",
        account_number: " 123-4-56789-0 ",
        promptpay_id: "x",
      }),
    ).toEqual({ bank_name: "KBank", account_name: "Ann A.", account_number: "1234567890" })
    expect(
      payoutInfoSchema.parse({ bank_name: "K", account_name: "A", account_number: "123 456 789 012" }),
    ).toEqual({ bank_name: "K", account_name: "A", account_number: "123456789012" })
  })

  // AF-15 (กฎ 39a, owner Q20): ตัด - และช่องว่างแล้วต้องเป็นตัวเลข 10–12 หลัก — แบบเดียวกับ validator ของ API
  it.each(["123-456-789", "1234567890123", "123456789A"])("rejects account_number %p", (account_number) => {
    expect(errorsOf({ bank_name: "K", account_name: "A", account_number })).toEqual({
      account_number: "Must be 10–12 digits",
    })
  })

  it("requires every field after trimming, with one message per field", () => {
    expect(errorsOf({ bank_name: " ", account_name: "Ann", account_number: "" })).toEqual({
      bank_name: "Required",
      account_number: "Required",
    })
    const result = payoutInfoSchema.safeParse({ bank_name: "K", account_name: "A", account_number: "" })
    expect(result.success ? [] : result.error.issues).toHaveLength(1)
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
