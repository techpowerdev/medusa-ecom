// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import {
  PROMOTION_FAILED,
  PROMOTION_REMOVE_FAILED,
} from "@modules/checkout/components/discount-code"

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

const render = async (props: { cart: never } = { cart }) => {
  const { default: DiscountCode } = await import("@modules/checkout/components/discount-code")
  await act(async () => {
    root.render(createElement(DiscountCode, props))
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

const deferred = <T>() => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("CORE-36: ปุ่มลบโค้ดส่วนลดกันคลิกซ้อน + ข้อความล้มเฉพาะการลบ (AC-130)", () => {
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

  const removeButton = () => byTestId("remove-discount-button") as HTMLButtonElement

  it("กดสองครั้งใน act เดียว → เรียก applyPromotions ครั้งเดียว; disabled + aria-busy ระหว่างรอ; resolve แล้วกดได้อีก", async () => {
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)
    await render()

    await act(async () => {
      removeButton().click()
      removeButton().click()
    })
    expect(applyPromotions).toHaveBeenCalledTimes(1)
    expect(removeButton().disabled).toBe(true)
    expect(removeButton().getAttribute("aria-busy")).toBe("true")

    await act(async () => {
      pending.resolve({ ok: true, codes: [] })
    })
    expect(removeButton().disabled).toBe(false)
    expect(removeButton().getAttribute("aria-busy")).not.toBe("true")

    applyPromotions.mockResolvedValueOnce({ ok: true, codes: [] })
    await click("remove-discount-button")
    expect(applyPromotions).toHaveBeenCalledTimes(2)
  })

  it("ลบล้มแบบ reject → ข้อความไทยเฉพาะการลบ ไม่เท่ากับ PROMOTION_FAILED", async () => {
    applyPromotions.mockRejectedValueOnce(new Error("network"))
    await render()
    await click("remove-discount-button")
    await vi.waitFor(() =>
      expect(byTestId("promotion-error")?.textContent).toBe(PROMOTION_REMOVE_FAILED)
    )
    expect(PROMOTION_REMOVE_FAILED).toMatch(/[\u0E00-\u0E7F]/)
    expect(PROMOTION_REMOVE_FAILED).not.toBe(PROMOTION_FAILED)
    expect(removeButton().disabled).toBe(false)
  })

  it("ลบได้ { error: 'failed' } → PROMOTION_REMOVE_FAILED", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("remove-discount-button")
    expect(byTestId("promotion-error")?.textContent).toBe(PROMOTION_REMOVE_FAILED)
  })

  it("ลบได้ unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "unauthorized" })
    await render()
    await click("remove-discount-button")
    expect(byTestId("promotion-error")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("ใส่โค้ดล้ม (failed) → ยังเป็น PROMOTION_FAILED เดิม", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("add-discount-button")
    ;(byTestId("discount-input") as HTMLInputElement).value = "NEW"
    await click("discount-apply-button")
    await vi.waitFor(() =>
      expect(byTestId("promotion-error")?.textContent).toBe(PROMOTION_FAILED)
    )
  })
})

describe("CORE-40: action โค้ดค้างได้ทีละหนึ่ง + ใส่โค้ดไม่พาโค้ดที่เพิ่งลบกลับมา (AC-134)", () => {
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

  const applyButton = () => byTestId("discount-apply-button") as HTMLButtonElement
  const removeButtons = () =>
    Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="remove-discount-button"]')
    )

  // ส่งฟอร์มตรงๆ (ไม่ผ่านปุ่ม) — จำลองกด Enter ในช่องใส่โค้ดแม้ปุ่ม disabled
  const submitCode = async (code: string) => {
    ;(byTestId("discount-input") as HTMLInputElement).value = code
    await act(async () => {
      byTestId("discount-input")!.closest("form")!.requestSubmit()
    })
  }

  it("ลบค้าง → ปุ่มใส่โค้ด disabled และส่งฟอร์มไม่ยิง action; resolve แล้วกดได้", async () => {
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)
    await render()
    await click("add-discount-button")

    await click("remove-discount-button")
    expect(applyButton().disabled).toBe(true)
    await submitCode("B")
    expect(applyPromotions).toHaveBeenCalledTimes(1)
    expect(applyPromotions).toHaveBeenLastCalledWith([])

    await act(async () => {
      pending.resolve({ ok: true, codes: [] })
    })
    expect(applyButton().disabled).toBe(false)
  })

  it("ลบสำเร็จด้วย codes: [] โดยไม่ re-render prop (cart ยังมี SAVE10) แล้วใส่ B → ส่ง [B] ไม่มีโค้ดที่ลบ", async () => {
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)
    await render()
    await click("add-discount-button")
    await click("remove-discount-button")
    await act(async () => {
      pending.resolve({ ok: true, codes: [] })
    })

    applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["B"] })
    await submitCode("B")
    await vi.waitFor(() => expect(applyPromotions).toHaveBeenCalledTimes(2))
    expect(applyPromotions).toHaveBeenLastCalledWith(["B"])
  })

  it("ลบล้ม (failed) → ใส่ B ครั้งถัดไปส่ง [SAVE10, B] (โค้ดเดิมยังอยู่)", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("add-discount-button")
    await click("remove-discount-button")
    expect(byTestId("promotion-error")?.textContent).toBe(PROMOTION_REMOVE_FAILED)

    applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["SAVE10", "B"] })
    await submitCode("B")
    await vi.waitFor(() => expect(applyPromotions).toHaveBeenCalledTimes(2))
    expect(applyPromotions).toHaveBeenLastCalledWith(["SAVE10", "B"])
  })

  it("ลบสำเร็จ (จำ codes: []) แล้ว cart prop refresh เป็น array ใหม่ [SAVE10, X] → ใส่ B ใช้ prop: [SAVE10, X, B]", async () => {
    applyPromotions.mockResolvedValueOnce({ ok: true, codes: [] })
    await render()
    await click("add-discount-button")
    await click("remove-discount-button")
    expect(applyPromotions).toHaveBeenLastCalledWith([])

    const refreshed = {
      id: "cart_1",
      currency_code: "thb",
      promotions: [
        { id: "promo_1", code: "SAVE10", is_automatic: false, application_method: { type: "percentage", value: 10, currency_code: "thb" } },
        { id: "promo_x", code: "X", is_automatic: false, application_method: { type: "percentage", value: 5, currency_code: "thb" } },
      ],
    } as never
    await render({ cart: refreshed })

    applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["SAVE10", "X", "B"] })
    await submitCode("B")
    await vi.waitFor(() => expect(applyPromotions).toHaveBeenCalledTimes(2))
    expect(applyPromotions).toHaveBeenLastCalledWith(["SAVE10", "X", "B"])
  })

  it("ส่งฟอร์มช่องว่าง → ล้าง error ของรอบก่อน และไม่ยิง action (พฤติกรรมเดิมก่อน CORE-40)", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("add-discount-button")
    await submitCode("NEW")
    await vi.waitFor(() =>
      expect(byTestId("promotion-error")?.textContent).toBe(PROMOTION_FAILED)
    )

    await submitCode("")
    await vi.waitFor(() => expect(byTestId("promotion-error")?.textContent ?? "").toBe(""))
    expect(applyPromotions).toHaveBeenCalledTimes(1)
  })

  it("ใส่โค้ดค้าง → ทุก remove-discount-button disabled และคลิกไม่ยิง action เพิ่ม", async () => {
    const pending = deferred<unknown>()
    applyPromotions.mockReturnValueOnce(pending.promise)
    await render()
    await click("add-discount-button")
    await submitCode("B")
    expect(applyPromotions).toHaveBeenCalledTimes(1)

    expect(removeButtons().length).toBeGreaterThan(0)
    for (const button of removeButtons()) {
      expect(button.disabled).toBe(true)
    }
    await act(async () => {
      removeButtons()[0].click()
    })
    expect(applyPromotions).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ ok: true, codes: ["SAVE10", "B"] })
    })
    expect(removeButtons()[0].disabled).toBe(false)
  })
})
