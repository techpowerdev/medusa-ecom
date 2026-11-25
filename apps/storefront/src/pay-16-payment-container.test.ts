// @vitest-environment jsdom
import { RadioGroup } from "@headlessui/react"
import { act, createElement as h } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import PaymentContainer, { StripePaymentContainer } from "@modules/checkout/components/payment-container"

// PAY-16 (spec 06 กฎข้อ 18 c/d, review #541): ใช้ RadioGroup ของ headless UI จริง (ไม่ mock) —
// (d) group disabled ต้องถึงทุกตัวเลือก (aria-disabled); (c) fieldsHidden แล้วไม่ render skeleton ของช่องบัตร
const CARD = "pp_stripe_stripe"
const MANUAL = "pp_system_default"
const info = { [CARD]: { title: "บัตร", icon: h("span") }, [MANUAL]: { title: "ทดสอบ", icon: h("span") } }

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const render = async (groupDisabled: boolean, fieldsHidden = false) => {
  await act(async () => {
    root.render(
      h(RadioGroup, { value: CARD, onChange: () => {}, disabled: groupDisabled }, [
        h(StripePaymentContainer, {
          key: CARD,
          paymentProviderId: CARD,
          selectedPaymentOptionId: CARD,
          paymentInfoMap: info,
          setError: () => {},
          setPaymentComplete: () => {},
          fieldsHidden,
        }),
        h(PaymentContainer, { key: MANUAL, paymentProviderId: MANUAL, selectedPaymentOptionId: CARD, paymentInfoMap: info }),
      ])
    )
  })
}

describe("PAY-16: ตัวเลือกวิธีชำระใน RadioGroup ของ headless UI จริง", () => {
  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("(d) RadioGroup disabled → ทุกตัวเลือก aria-disabled", async () => {
    await render(true)
    expect(byTestId(`payment-option-${CARD}`)!.getAttribute("aria-disabled")).toBe("true")
    expect(byTestId(`payment-option-${MANUAL}`)!.getAttribute("aria-disabled")).toBe("true")
  })

  it("(d) RadioGroup ไม่ disabled → ตัวเลือกเลือกได้", async () => {
    await render(false)
    expect(byTestId(`payment-option-${CARD}`)!.getAttribute("aria-disabled")).toBeNull()
    expect(byTestId(`payment-option-${MANUAL}`)!.getAttribute("aria-disabled")).toBeNull()
  })

  it("(c) ตัวเลือกบัตรที่เลือกอยู่: ปกติแสดง skeleton ระหว่างรอ, fieldsHidden → ไม่มี skeleton", async () => {
    await render(false)
    expect(byTestId("skeleton-card-details")).not.toBeNull()
    await render(false, true)
    expect(byTestId("skeleton-card-details")).toBeNull()
  })
})
