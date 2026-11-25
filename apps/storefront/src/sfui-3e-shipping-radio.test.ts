// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// SFUI-3e (spec 09 กฎ 4, 9, 12–13, AC-13): ตัวเลือกจัดส่งเป็น RadioGroup ของ shadcn (Radix) จริง (ไม่ mock) —
// ตัวเลือกคือปุ่ม role="radio" ที่มี testid `delivery-option-radio` + `data-option-id` และชื่อ/ราคาอยู่ข้างใน,
// ไม่มีตัวที่ติ๊กตอนเริ่ม (core-32: `[aria-checked="true"], [checked]` = 0), RadioGroup ไม่อยู่ใน <form> จึงไม่มี input ซ่อน
// (ไม่ต้องกันบั๊ก form reset ของ Radix — qa #353 D-1), เลือกแล้วเรียก setShippingMethod ครั้งเดียว และล้มแล้วกลับค่าเดิม
const step = { value: "delivery" as string | null }
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => (k === "step" ? step.value : null) }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/th/checkout",
}))
const setShippingMethod = vi.fn()
vi.mock("@lib/data/cart", () => ({ setShippingMethod: (...a: unknown[]) => setShippingMethod(...a) }))
const calculatePriceForShippingOption = vi.fn()
vi.mock("@lib/data/fulfillment", () => ({
  calculatePriceForShippingOption: (...a: unknown[]) => calculatePriceForShippingOption(...a),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const standard = { id: "so_standard", name: "มาตรฐาน", price_type: "flat", amount: 50, type: { code: "standard" } }
const express = { id: "so_express", name: "ด่วน", price_type: "flat", amount: 120, type: { code: "express" } }
const calculated = { id: "so_calc", name: "คำนวณ", price_type: "calculated", type: { code: "calc" } }
const pickupAt = (id: string, insufficient_inventory = false) => ({
  id,
  name: `สาขา ${id}`,
  price_type: "flat",
  amount: 0,
  insufficient_inventory,
  type: { code: "pickup" },
  service_zone: { fulfillment_set: { type: "pickup", location: { address: { address_1: "ถนน 1", country_code: "th" } } } },
})

const cartWith = (shipping_methods: unknown[] = []) =>
  ({
    id: "cart_1",
    currency_code: "thb",
    items: [{ id: "item_1", requires_shipping: true }],
    shipping_methods,
    shipping_address: { address_1: "1" },
    billing_address: { address_1: "1" },
    email: "a@example.com",
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (cart: unknown, availableShippingMethods: unknown[]) => {
  const { default: Shipping } = await import("@modules/checkout/components/shipping")
  await act(async () => {
    root.render(createElement(Shipping, { cart, availableShippingMethods } as never))
  })
}

const option = (id: string) =>
  container.querySelector<HTMLButtonElement>(`[data-testid="delivery-option-radio"][data-option-id="${id}"]`)!
const radios = () => Array.from(container.querySelectorAll<HTMLElement>('[data-testid="delivery-option-radio"]'))
const click = async (el: HTMLElement) => {
  await act(async () => {
    el.click()
  })
}

describe("SFUI-3e: ตัวเลือกจัดส่งใน RadioGroup ของ shadcn (Radix)", () => {
  beforeEach(() => {
    step.value = "delivery"
    setShippingMethod.mockReset().mockResolvedValue({ ok: true })
    calculatePriceForShippingOption.mockReset().mockResolvedValue(null)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("testid + data-option-id อยู่บนปุ่ม role=radio ใน radiogroup ที่มีชื่อและราคาอยู่ข้างใน", async () => {
    await render(cartWith(), [standard, express])
    const el = option(standard.id)
    expect(el.tagName).toBe("BUTTON")
    expect(el.getAttribute("role")).toBe("radio")
    expect(el.getAttribute("data-slot")).toBe("radio-group-item")
    expect(el.closest('[role="radiogroup"]')).not.toBeNull()
    expect(el.textContent).toContain("มาตรฐาน")
    expect(el.textContent).toMatch(/50/)
    expect(radios()).toHaveLength(2)
  })

  it("ยังไม่เลือก → ไม่มีตัวที่ติ๊ก ไม่มี [checked] และไม่มี input ซ่อน (ไม่อยู่ใน <form>)", async () => {
    await render(cartWith(), [standard, express])
    const box = container.querySelector('[data-testid="delivery-options-container"]')!
    expect(box.querySelectorAll('[aria-checked="true"], [checked]')).toHaveLength(0)
    expect(radios().every((r) => r.getAttribute("aria-checked") === "false")).toBe(true)
    expect(box.querySelectorAll("input")).toHaveLength(0)
    expect(box.closest("form")).toBeNull()
  })

  it("คลิกตัวเลือก → setShippingMethod(id) ครั้งเดียวและตัวนั้นติ๊ก; คลิกตัวที่เลือกอยู่ → ไม่เรียกซ้ำ", async () => {
    await render(cartWith(), [standard, express])
    await click(option(express.id))
    expect(setShippingMethod).toHaveBeenCalledTimes(1)
    expect(setShippingMethod).toHaveBeenCalledWith({ cartId: "cart_1", shippingMethodId: express.id })
    expect(option(express.id).getAttribute("aria-checked")).toBe("true")
    expect(option(standard.id).getAttribute("aria-checked")).toBe("false")
    await click(option(express.id))
    expect(setShippingMethod).toHaveBeenCalledTimes(1)
  })

  it("กฎ 12: focus ตัวเลือกแรกแล้วกด ArrowDown (ค้าง) → ตัวถัดไปได้ focus และถูกเลือกผ่าน setShippingMethod", async () => {
    await render(cartWith([{ id: "sm_1", shipping_option_id: standard.id, name: "มาตรฐาน", amount: 50 }]), [
      standard,
      express,
    ])
    const first = option(standard.id)
    await act(async () => first.focus())
    // Radix: keydown ที่ document ตั้ง isArrowKeyPressed แล้ว RovingFocus ย้าย focus (setTimeout) → ตัวที่ได้ focus ขณะปุ่มค้างถูกเลือก
    await act(async () => {
      const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      first.dispatchEvent(down)
      await new Promise((r) => setTimeout(r, 10))
    })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", bubbles: true }))
    })
    expect(document.activeElement).toBe(option(express.id))
    expect(setShippingMethod).toHaveBeenCalledWith({ cartId: "cart_1", shippingMethodId: express.id })
    expect(option(express.id).getAttribute("aria-checked")).toBe("true")
  })

  it("เลือกไม่สำเร็จ → กลับไปตัวเดิม และแสดงข้อความไทย", async () => {
    setShippingMethod.mockResolvedValueOnce({ error: "failed" })
    await render(cartWith([{ id: "sm_1", shipping_option_id: standard.id, name: "มาตรฐาน", amount: 50 }]), [
      standard,
      express,
    ])
    expect(option(standard.id).getAttribute("aria-checked")).toBe("true")
    await click(option(express.id))
    expect(option(standard.id).getAttribute("aria-checked")).toBe("true")
    expect(option(express.id).getAttribute("aria-checked")).toBe("false")
    expect(container.querySelector('[data-testid="delivery-option-error-message"]')?.textContent).toMatch(/[฀-๿]/)
  })

  it("option แบบ calculated ที่คำนวณราคาไม่ได้ → disabled (+ aria-disabled แบบเดิม) และคลิกแล้วไม่เลือก", async () => {
    await render(cartWith(), [standard, calculated])
    await act(async () => {})
    const el = option(calculated.id)
    expect(el.disabled).toBe(true)
    expect(el.getAttribute("aria-disabled")).toBe("true")
    expect(option(standard.id).disabled).toBe(false)
    expect(option(standard.id).getAttribute("aria-disabled")).toBeNull()
    await click(el)
    expect(setShippingMethod).not.toHaveBeenCalled()
  })

  it("มี pickup → ตัวเลือก 'รับสินค้าด้วยตนเอง' เลือก pickup ตัวแรกที่มีของ แล้วแสดงรายการสาขา (ตัวที่ของไม่พอ disabled)", async () => {
    const short = pickupAt("so_pick_short", true)
    const ok = pickupAt("so_pick_ok")
    await render(cartWith(), [standard, short, ok])
    const pickupToggle = radios().find((r) => !r.hasAttribute("data-option-id"))!
    expect(pickupToggle.getAttribute("role")).toBe("radio")
    expect(pickupToggle.textContent).toContain("รับสินค้าด้วยตนเอง")
    await click(pickupToggle)
    expect(setShippingMethod).toHaveBeenCalledWith({ cartId: "cart_1", shippingMethodId: ok.id })
    expect(pickupToggle.getAttribute("aria-checked")).toBe("true")
    const branches = radios().filter((r) => r.textContent?.includes("สาขา so_pick"))
    expect(branches).toHaveLength(2)
    const shortBtn = branches.find((r) => r.textContent?.includes("so_pick_short")) as HTMLButtonElement
    const okBtn = branches.find((r) => r.textContent?.includes("so_pick_ok")) as HTMLButtonElement
    expect(shortBtn.disabled).toBe(true)
    expect(okBtn.getAttribute("aria-checked")).toBe("true")
  })
})
