// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"

// CORE-28 (spec 01 กฎข้อ 85, AC-121; qa #222 O-2): `promotion-error` ต้อง render นอก `isOpen`
// — error ของการใส่/ลบโค้ด (รวม SIGN_IN_AGAIN_MESSAGE) เห็นทันทีไม่ว่าช่องใส่โค้ดเปิดหรือปิด
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

const render = async () => {
  const { default: DiscountCode } = await import("@modules/checkout/components/discount-code")
  await act(async () => {
    root.render(createElement(DiscountCode, { cart }))
  })
}

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const click = async (id: string) => {
  await act(async () => {
    byTestId(id)!.click()
  })
}

describe("CORE-28: promotion-error เห็นได้แม้ช่องใส่โค้ดปิด (AC-121)", () => {
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

  it("ช่องปิด + ลบโค้ดได้ unauthorized → promotion-error = SIGN_IN_AGAIN_MESSAGE โดยไม่ต้องเปิดช่อง", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "unauthorized" })
    await render()
    expect(byTestId("discount-input")).toBeNull()
    await click("remove-discount-button")
    expect(applyPromotions).toHaveBeenCalledWith([])
    expect(byTestId("discount-input"), "ช่องใส่โค้ดต้องยังปิด").toBeNull()
    expect(byTestId("promotion-error")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("ใส่โค้ดที่ใช้ไม่ได้แล้วปิดช่อง → promotion-error ยังมีข้อความ; ลบโค้ดสำเร็จ → ว่าง", async () => {
    applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["SAVE10"] })
    await render()
    await click("add-discount-button")
    const input = byTestId("discount-input") as HTMLInputElement
    input.value = "EXPIRED"
    await click("discount-apply-button")
    await vi.waitFor(() => expect(byTestId("promotion-error")?.textContent).toMatch(/[฀-๿]/))
    expect(applyPromotions).toHaveBeenCalledWith(["SAVE10", "EXPIRED"])
    const message = byTestId("promotion-error")!.textContent

    await click("add-discount-button")
    expect(byTestId("discount-input"), "ช่องใส่โค้ดต้องปิดแล้ว").toBeNull()
    expect(byTestId("promotion-error")?.textContent).toBe(message)

    applyPromotions.mockResolvedValueOnce({ ok: true, codes: [] })
    await click("remove-discount-button")
    expect(byTestId("promotion-error")?.textContent ?? "").toBe("")
  })
})

describe("CORE-28: comment ใน e2e core-19c ตรงกับพฤติกรรมหลัง CORE-14g", () => {
  it("ไม่มีวลี 'ก่อนถึง action'", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../e2e/core-19c-delete-button-error.spec.ts"),
      "utf8"
    )
    expect(src.includes("ก่อนถึง action")).toBe(false)
  })
})
