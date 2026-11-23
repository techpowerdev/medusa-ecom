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

// GB-32 กฎข้อ 58 (c), AC-75 (c): query.graph ของ deleteMemberPaymentSessionsStep อยู่ใน best-effort เดียวกับการลบ session
// ล้ม → warn GROUP_BUY_SESSION_CANCEL_FAILED แล้วไปต่อ (workflow ไม่ล้ม → membership/order ที่ยกเลิกแล้วไม่ถูก compensate)
describe("deleteMemberPaymentSessionsStep — best-effort query", () => {
  it("query.graph throws → warns GROUP_BUY_SESSION_CANCEL_FAILED and the workflow succeeds", async () => {
    const { createWorkflow, WorkflowResponse } = jest.requireActual("@medusajs/framework/workflows-sdk")
    const { ContainerRegistrationKeys, createMedusaContainer } = jest.requireActual("@medusajs/framework/utils")
    const { asValue } = jest.requireActual("@medusajs/framework/awilix")
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }
    const container = createMedusaContainer()
    container.register({
      [ContainerRegistrationKeys.LOGGER]: asValue(logger),
      [ContainerRegistrationKeys.QUERY]: asValue({ graph: jest.fn().mockRejectedValue(new Error("db down")) }),
    })
    const workflow = createWorkflow("gb32-test-delete-member-payment-sessions", function (input: { id: string; order_id: string }[]) {
      membershipPayment.deleteMemberPaymentSessionsStep(input)
      return new WorkflowResponse(input)
    })

    const { errors } = await workflow(container).run({
      input: [{ id: "gbmem_1", order_id: "order_1" }],
      throwOnError: false,
    })

    expect(errors).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${membershipPayment.GROUP_BUY_SESSION_CANCEL_FAILED} .*order_1.*db down`))
    )
  })
})
