// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import AccountInfo from "./index"

// SFUI-3c (spec 09 กฎ 4a, 9, AC-11): แผงแก้ไขเป็น `Collapsible` ของ shadcn ที่ render ตลอด (forceMount) และคง `data-open`
// บน element ที่มี testid; แผงข้อความสำเร็จ/ผิดพลาดเป็น div ธรรมดา และข้อความยาวตัดบรรทัดได้ (review SFUI-2: Badge ของ shadcn
// เป็น whitespace-nowrap + overflow-hidden → ข้อความไทยยาวจาก server ถูกตัดที่จอ 390px)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const LONG_ERROR = "เบอร์โทรศัพท์นี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้เบอร์อื่นหรือติดต่อฝ่ายบริการลูกค้าเพื่อขอความช่วยเหลือ"

const render = (props: { isSuccess?: boolean; isError?: boolean } = {}) =>
  act(() =>
    root.render(
      createElement(AccountInfo, {
        label: "เบอร์โทร",
        currentInfo: "0812345678",
        clearState: () => {},
        errorMessage: LONG_ERROR,
        "data-testid": "account-phone-editor",
        ...props,
      }, createElement("input", { name: "phone", "data-testid": "phone-input" }))
    )
  )

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

describe("SFUI-3c: account-info → Collapsible", () => {
  it("แผงปิด: render อยู่ (forceMount) ไม่ซ่อนด้วย hidden, data-open=false, inert และเป็น collapsible-content", () => {
    render()
    const panel = byTestId("edit-panel")
    expect(panel).not.toBeNull()
    expect(panel.getAttribute("data-slot")).toBe("collapsible-content")
    expect(panel.getAttribute("data-open")).toBe("false")
    expect(panel.hasAttribute("hidden")).toBe(false)
    expect(panel.hasAttribute("inert")).toBe(true) // jsdom ไม่มี property inert
    expect(panel.className).toContain("max-h-0")
    expect(byTestId("edit-button").getAttribute("aria-expanded")).toBe("false")
  })

  it("กดแก้ไข → data-open=true, ไม่ inert, ปุ่ม aria-expanded=true และชี้แผงด้วย aria-controls", () => {
    render()
    act(() => byTestId("edit-button").click())
    const panel = byTestId("edit-panel")
    expect(panel.getAttribute("data-open")).toBe("true")
    expect(panel.hasAttribute("inert")).toBe(false)
    expect(panel.className).toContain("max-h-[1000px]")
    const button = byTestId("edit-button")
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(button.getAttribute("aria-controls")).toBe(panel.id)
    expect(button.textContent).toBe("ยกเลิก")
    act(() => byTestId("edit-button").click())
    expect(byTestId("edit-panel").getAttribute("data-open")).toBe("false")
  })

  it("success-message / error-message เป็น div ธรรมดา (ไม่ใช่ Collapsible) ซ่อน/แสดงด้วย class เดิม", () => {
    render({ isError: true })
    for (const id of ["success-message", "error-message"]) {
      expect(byTestId(id).tagName, id).toBe("DIV")
      expect(byTestId(id).hasAttribute("data-slot"), id).toBe(false)
    }
    expect(byTestId("error-message").className).toContain("opacity-100")
    expect(byTestId("success-message").className).toContain("opacity-0")
  })

  // SFUI-21d (spec 09 กฎ 74 (a)): error = Alert ผ่าน ErrorMessage (เดิม Badge destructive) — ตัดบรรทัดได้เหมือนเดิม
  it("ข้อความผิดพลาดยาวตัดบรรทัดได้ (Alert ไม่ whitespace-nowrap)", () => {
    render({ isError: true })
    const message = byTestId("error-message").querySelector<HTMLElement>("[data-slot=alert]")!
    expect(message.textContent).toBe(LONG_ERROR)
    expect(message.className).not.toMatch(/(^|\s)whitespace-nowrap(\s|$)/)
  })
})
