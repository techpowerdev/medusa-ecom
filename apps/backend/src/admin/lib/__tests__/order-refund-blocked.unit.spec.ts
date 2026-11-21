import { ACTIVE_ORDER_CHANGE_STATUSES as GUARD_STATUSES } from "../../../lib/active-order-change"
import { ACTIVE_ORDER_CHANGE_REFUND_MESSAGE } from "../../../api/admin/payments/middlewares"
import {
  ACTIVE_ORDER_CHANGE_STATUSES,
  REFUND_BLOCKED_MESSAGE,
  pendingChangeTypes,
} from "../order-refund-blocked"

// PAY-10 (spec 06 กฎข้อ 12): widget ต้องเตือนด้วยเงื่อนไขเดียวกับ middleware ของ PAY-8 (กฎข้อ 10b)
describe("order refund blocked widget", () => {
  it("uses the same active statuses as the PAY-8 refund guard", () => {
    expect([...ACTIVE_ORDER_CHANGE_STATUSES].sort()).toEqual([...GUARD_STATUSES].sort())
  })

  it("warns with the message of rule 12, matching the wording of the PAY-8 toast", () => {
    expect(REFUND_BLOCKED_MESSAGE).toBe(
      "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first."
    )
    expect(ACTIVE_ORDER_CHANGE_REFUND_MESSAGE).toContain("active return, claim, exchange or edit. Confirm or cancel it first.")
  })

  it("lists each pending change type once, in a readable form", () => {
    expect(
      pendingChangeTypes([
        { change_type: "return" },
        { change_type: "return" },
        { change_type: "update_order" },
        { change_type: null },
      ])
    ).toEqual(["return", "update order", "order change"])
  })

  it("is empty when nothing is pending", () => {
    expect(pendingChangeTypes([])).toEqual([])
    expect(pendingChangeTypes(undefined)).toEqual([])
  })
})
