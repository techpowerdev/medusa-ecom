// @vitest-environment jsdom
import { act, createElement as h } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RadioGroup } from "@/components/ui/radio-group"
import PaymentContainer, { StripePaymentContainer } from "@modules/checkout/components/payment-container"

// PAY-16 (spec 06 กฎข้อ 18 c/d, review #541): ใช้ RadioGroup ของ shadcn (Radix) จริง (ไม่ mock) —
// (d) group disabled ต้องถึงทุกตัวเลือก; (c) fieldsHidden แล้วไม่ render skeleton ของช่องบัตร
// SFUI-3d (spec 09 กฎ 4, 9, 12, AC-12): testid อยู่บน RadioGroupItem (`role="radio"`); SFUI-21c (กฎ 80): ชื่อวิธีชำระอยู่ในการ์ด
// (`<label>` ของ Choice Card) ที่ครอบปุ่ม, ช่องบัตร (Stripe) อยู่ถัดจากการ์ดนอก `<label>` ใน wrapper ของรายการเดียวกัน, คลิกตัวที่เลือกอยู่ไม่เรียก onValueChange (PAY-14/order-pay พึ่งพฤติกรรมนี้)
const CARD = "pp_stripe_stripe"
const MANUAL = "pp_system_default"
const info = { [CARD]: { title: "บัตร", icon: h("span") }, [MANUAL]: { title: "ทดสอบ", icon: h("span") } }

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const onValueChange = vi.fn()

const render = async (
  groupDisabled: boolean,
  fieldsHidden = false,
  { value = CARD, manualDisabled }: { value?: string; manualDisabled?: boolean } = {}
) => {
  await act(async () => {
    root.render(
      h(RadioGroup, { value, onValueChange, disabled: groupDisabled }, [
        h(StripePaymentContainer, {
          key: CARD,
          paymentProviderId: CARD,
          selectedPaymentOptionId: value,
          paymentInfoMap: info,
          setError: () => {},
          setPaymentComplete: () => {},
          fieldsHidden,
        }),
        h(PaymentContainer, {
          key: MANUAL,
          paymentProviderId: MANUAL,
          selectedPaymentOptionId: value,
          paymentInfoMap: info,
          disabled: manualDisabled,
        }),
      ])
    )
  })
}

describe("PAY-16: ตัวเลือกวิธีชำระใน RadioGroup ของ shadcn (Radix) จริง", () => {
  beforeEach(() => {
    onValueChange.mockClear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("(d) RadioGroup disabled → ทุกตัวเลือก disabled", async () => {
    await render(true)
    expect((byTestId(`payment-option-${CARD}`) as HTMLButtonElement).disabled).toBe(true)
    expect((byTestId(`payment-option-${MANUAL}`) as HTMLButtonElement).disabled).toBe(true)
  })

  it("(d) RadioGroup ไม่ disabled → ตัวเลือกเลือกได้", async () => {
    await render(false)
    expect((byTestId(`payment-option-${CARD}`) as HTMLButtonElement).disabled).toBe(false)
    expect((byTestId(`payment-option-${MANUAL}`) as HTMLButtonElement).disabled).toBe(false)
  })

  it("(c) ตัวเลือกบัตรที่เลือกอยู่: ปกติแสดง skeleton ระหว่างรอ, fieldsHidden → ไม่มี skeleton", async () => {
    await render(false)
    expect(byTestId("skeleton-card-details")).not.toBeNull()
    await render(false, true)
    expect(byTestId("skeleton-card-details")).toBeNull()
  })

  it("SFUI-3d: testid อยู่บนปุ่ม role=radio (ชื่อวิธีชำระอยู่ในการ์ด label ของปุ่ม) และสถานะเลือกอยู่ใน aria-checked", async () => {
    await render(false)
    const card = byTestId(`payment-option-${CARD}`)!
    const manual = byTestId(`payment-option-${MANUAL}`)!
    expect(card.tagName).toBe("BUTTON")
    expect(card.getAttribute("role")).toBe("radio")
    expect(card.getAttribute("aria-checked")).toBe("true")
    expect(manual.getAttribute("aria-checked")).toBe("false")
    expect(card.closest("label")?.htmlFor).toBe(card.id)
    expect(card.closest("label")?.textContent).toContain("บัตร")
    expect(manual.closest("label")?.textContent).toContain("ทดสอบ")
  })

  it("SFUI-3d/21c: ช่องบัตร (skeleton/Stripe) อยู่นอกปุ่ม radio และนอก label แต่อยู่ใน wrapper ของตัวเลือกเดียวกัน", async () => {
    await render(false)
    const skeleton = byTestId("skeleton-card-details")!
    const card = byTestId(`payment-option-${CARD}`)!
    const label = card.closest("label")!
    expect(card.contains(skeleton)).toBe(false)
    expect(label.contains(skeleton)).toBe(false)
    expect(skeleton.closest("label")).toBeNull()
    expect(label.parentElement!.contains(skeleton)).toBe(true)
  })

  it("SFUI-3d: คลิกตัวที่ยังไม่เลือก → onValueChange(id); คลิกตัวที่เลือกอยู่ → ไม่เรียก", async () => {
    await render(false)
    await act(async () => byTestId(`payment-option-${MANUAL}`)!.click())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(MANUAL)
    onValueChange.mockClear()
    await act(async () => byTestId(`payment-option-${CARD}`)!.click())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("SFUI-3d: prop disabled ของตัวเลือกเอง (order-pay ส่ง busy) → ตัวนั้น disabled แม้ group ไม่ disabled", async () => {
    await render(false, false, { manualDisabled: true })
    expect((byTestId(`payment-option-${MANUAL}`) as HTMLButtonElement).disabled).toBe(true)
    expect((byTestId(`payment-option-${CARD}`) as HTMLButtonElement).disabled).toBe(false)
    // payments-order-pay (AC-19 d2) อ่าน aria-disabled="true" ของตัวเลือกระหว่างส่ง — Radix ใส่แค่ disabled/data-disabled
    expect(byTestId(`payment-option-${MANUAL}`)!.getAttribute("aria-disabled")).toBe("true")
    expect(byTestId(`payment-option-${CARD}`)!.getAttribute("aria-disabled")).toBeNull()
  })
})
