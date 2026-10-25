import { MedusaError } from "@medusajs/framework/utils"
import { CUSTOMER_REQUIRED_MESSAGE, assertCartCustomer } from "../customer-only"

// CORE-6 (spec 01 "ไม่มี guest"): cart ต้องผูกกับ customer ที่มีบัญชี
describe("assertCartCustomer", () => {
  const rejects = (customer: Parameters<typeof assertCartCustomer>[0]) => {
    let error: unknown
    try {
      assertCartCustomer(customer)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(MedusaError)
    expect(error).toMatchObject({ type: MedusaError.Types.NOT_ALLOWED, message: CUSTOMER_REQUIRED_MESSAGE })
  }

  it("rejects a cart without a customer", () => {
    rejects(undefined)
    rejects(null)
    rejects({ id: null, has_account: true })
  })

  it("rejects a guest customer (created from email only, has_account=false)", () => {
    rejects({ id: "cus_guest", has_account: false })
    rejects({ id: "cus_guest" })
  })

  it("accepts a registered customer", () => {
    expect(() => assertCartCustomer({ id: "cus_1", has_account: true })).not.toThrow()
  })
})
