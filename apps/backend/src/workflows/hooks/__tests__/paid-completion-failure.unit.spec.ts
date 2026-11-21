import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  CART_COMPLETION_FAILED_AFTER_PAYMENT,
  warnIfCompletionFailedAfterPayment,
} from "../paid-completion-failure"

// OPS-32 (spec 07 AC-47 a): complete ล้มหลัง capture → warn 1 บรรทัดแทนการให้ ops เดาจาก log ของ Medusa
// ("Error was thrown trying to refund payment … [object Object]" ทั้งที่คืนเงินสำเร็จ — ADR-025 บริบท)
type Session = { id: string; payment?: { id: string; captured_at: Date | null } | null }

function setup(sessions: Session[] | Error) {
  const warn = jest.fn()
  const graph = jest.fn(async () => {
    if (sessions instanceof Error) {
      throw sessions
    }
    return { data: sessions }
  })
  const container = {
    resolve: (key: string) =>
      key === ContainerRegistrationKeys.LOGGER ? { warn } : key === ContainerRegistrationKeys.QUERY ? { graph } : undefined,
  } as unknown as MedusaContainer
  return { container, warn, graph }
}

describe("warnIfCompletionFailedAfterPayment (OPS-32)", () => {
  it("payment captured แล้ว → warn 1 บรรทัดขึ้นต้น marker พร้อม cart_id, payment_session_id, payment_id, code และวิธีตรวจ", async () => {
    const { container, warn, graph } = setup([
      { id: "payses_old", payment: null },
      { id: "payses_paid", payment: { id: "pay_1", captured_at: new Date() } },
    ])

    await warnIfCompletionFailedAfterPayment(container, {
      cart_id: "cart_1",
      payment_session_ids: ["payses_old", "payses_paid"],
      code: "FLASH_LIMIT_EXCEEDED",
    })

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "payment_session", filters: { id: ["payses_old", "payses_paid"] } })
    )
    expect(warn).toHaveBeenCalledTimes(1)
    const line: string = warn.mock.calls[0][0]
    expect(line.startsWith(`${CART_COMPLETION_FAILED_AFTER_PAYMENT} `)).toBe(true)
    expect(line).toContain("cart_id=cart_1")
    expect(line).toContain("payment_session_id=payses_paid")
    expect(line).toContain("payment_id=pay_1")
    expect(line).toContain("code=FLASH_LIMIT_EXCEEDED")
    expect(line).toContain(
      "Medusa refunds automatically; a following 'Error was thrown trying to refund payment' line comes from re-creating the payment session — verify refunds via GET /admin/payments/:id"
    )
  })

  it("ยังไม่ capture (เช่น complete ผ่าน storefront ล้มก่อน authorize) → ไม่ warn", async () => {
    const { container, warn } = setup([{ id: "payses_1", payment: { id: "pay_1", captured_at: null } }])
    await warnIfCompletionFailedAfterPayment(container, { cart_id: "cart_1", payment_session_ids: ["payses_1"], code: "X" })
    expect(warn).not.toHaveBeenCalled()
  })

  it("cart ไม่มี payment session → ไม่ query และไม่ warn", async () => {
    const { container, warn, graph } = setup([])
    await warnIfCompletionFailedAfterPayment(container, { cart_id: "cart_1", payment_session_ids: [], code: "X" })
    expect(graph).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it("query ล้ม → ไม่โยน error (ไม่บัง error เดิมของ complete) และ warn ที่ไม่ขึ้นต้น marker", async () => {
    const { container, warn } = setup(new Error("db down"))
    await expect(
      warnIfCompletionFailedAfterPayment(container, { cart_id: "cart_1", payment_session_ids: ["payses_1"], code: "X" })
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).not.toMatch(new RegExp(`^${CART_COMPLETION_FAILED_AFTER_PAYMENT}`))
    expect(warn.mock.calls[0][0]).toContain("db down")
  })
})
