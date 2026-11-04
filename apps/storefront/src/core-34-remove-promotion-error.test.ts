// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"

// CORE-34 (spec 01 กฎข้อ 92, AC-128; qa #241 O-3): `removePromotionCode` ล้าง error เดิมก่อนส่ง request
// แบบเดียวกับ `addPromotionCode` — error ของรอบก่อนไม่ค้างระหว่างลบ
const applyPromotions = vi.fn()
vi.mock("@lib/data/cart", () => ({
  applyPromotions: (...a: unknown[]) => applyPromotions(...a),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cart = {
  id: "cart_1",
  currency_code: "thb",
  promotions: [
    {
      id: "promo_1",
      code: "SAVE10",
      is_automatic: false,
      application_method: { type: "percentage", value: 10, currency_code: "thb" },
    },
  ],
} as never

let container: HTMLDivElement
let root: Root

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const click = async (id: string) => {
  await act(async () => {
    byTestId(id)!.click()
  })
}

const deferred = <T>() => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// Given: promotion-error มีข้อความจากการใส่โค้ดที่ใช้ไม่ได้ (Medusa ตอบ 200 แต่ไม่ใส่โค้ด — กฎข้อ 63b)
const renderWithFailedAdd = async () => {
  const { default: DiscountCode } = await import("@modules/checkout/components/discount-code")
  await act(async () => {
    root.render(createElement(DiscountCode, { cart }))
  })
  applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["SAVE10"] })
  await click("add-discount-button")
  ;(byTestId("discount-input") as HTMLInputElement).value = "EXPIRED"
  await click("discount-apply-button")
  await vi.waitFor(() => expect(byTestId("promotion-error")?.textContent).toMatch(/[฀-๿]/))
}

describe("CORE-34: ลบโค้ดส่วนลดล้าง error เดิมก่อนส่ง (AC-128)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("ระหว่างรอผลการลบไม่มี promotion-error; ลบสำเร็จแล้วก็ยังไม่มี", async () => {
    await renderWithFailedAdd()
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)

    await click("remove-discount-button")
    expect(applyPromotions).toHaveBeenLastCalledWith([])
    expect(byTestId("promotion-error"), "error เดิมต้องหายก่อน resolve").toBeNull()

    await act(async () => {
      pending.resolve({ ok: true, codes: [] })
    })
    expect(byTestId("promotion-error")).toBeNull()
  })

  it("ระหว่างรอไม่มี promotion-error; ลบได้ unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    await renderWithFailedAdd()
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)

    await click("remove-discount-button")
    expect(byTestId("promotion-error"), "error เดิมต้องหายก่อน resolve").toBeNull()

    await act(async () => {
      pending.resolve({ error: "unauthorized" })
    })
    await vi.waitFor(() =>
      expect(byTestId("promotion-error")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
    )
  })
})
