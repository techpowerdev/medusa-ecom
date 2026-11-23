import * as membershipPayment from "../membership-payment"

// GB-28 กฎข้อ 53 (c), AC-71 (c): ชื่อ workflow กับชื่อ step ใน membership-payment.ts ต้องไม่ซ้ำกัน
// (ชื่อซ้ำทำให้ log/execution ของ workflow engine แยก workflow กับ step ไม่ออก)
describe("membership-payment workflow/step names", () => {
  const exported = Object.values(membershipPayment) as any[]
  const workflowNames = exported.filter((v) => typeof v?.getName === "function").map((v) => v.getName() as string)
  const stepNames = exported.filter((v) => typeof v?.__step__ === "string").map((v) => v.__step__ as string)

  it("finds the check workflow and its step", () => {
    expect(workflowNames).toContain(membershipPayment.checkGroupBuyMembershipPaymentWorkflow.getName())
    expect(stepNames).toContain((membershipPayment.checkMembershipPaymentStep as any).__step__)
  })

  it("no workflow shares its name with a step", () => {
    expect(workflowNames.filter((name) => stepNames.includes(name))).toEqual([])
  })
})
