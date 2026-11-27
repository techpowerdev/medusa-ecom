// @vitest-environment jsdom
import { act, useId, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Input, { useFieldError } from "./index"

// SFUI-15 (spec 09 กฎ 40b, 42–44, AC-40/41; ADR-033): select ของ shadcn (Radix) ประกอบตามตัวอย่าง docs ตรงที่ใช้ — ไม่มี component กลาง
// โครงในไฟล์นี้ = โครงที่ผู้เรียกจริงใช้ (กฎ 40b); render primitive ของ `ui/` จริง ไม่ mock (บทเรียน PAY-16)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom ไม่มี API ที่ Radix Select ใช้ (ADR-033 ผลที่ตามมา)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const COUNTRIES = [
  ["th", "ไทย"],
  ["la", "ลาว"],
  ["mm", "เมียนมา"],
] as const

type CountryFieldProps = { testId?: string; name?: string; required?: boolean; defaultValue?: string; error?: string }

/** แบบ `defaultValue` + state จาก `onValueChange` (กฎ 40b) — ข้อความบน trigger/`data-value` มาจาก state */
function CountryField({ testId = "country", name = "country_code", required = true, defaultValue, error }: CountryFieldProps) {
  const id = useId()
  const [value, setValue] = useState(defaultValue ?? "")
  const { fieldProps, controlProps, messages } = useFieldError<HTMLButtonElement>(null, {
    id,
    label: "ประเทศ",
    testId,
    control: "select",
    error,
    props: { value },
  })
  return (
    <Field {...fieldProps}>
      <FieldLabel htmlFor={id} data-testid={`${testId}-label`}>
        ประเทศ
        {required && <span aria-hidden="true">*</span>}
      </FieldLabel>
      <Select name={name} required={required} defaultValue={defaultValue} onValueChange={setValue}>
        <SelectTrigger id={id} data-testid={testId} data-value={value} className="w-full" {...controlProps}>
          <SelectValue placeholder="เลือกประเทศ">{COUNTRIES.find(([v]) => v === value)?.[1]}</SelectValue>
        </SelectTrigger>
        <SelectContent data-testid={`${testId}-options`}>
          {COUNTRIES.map(([v, text]) => (
            <SelectItem key={v} value={v} data-testid={`${testId}-option`} data-value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {messages}
    </Field>
  )
}

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

let submitted = 0
const render = (node: ReactNode) =>
  act(() =>
    root.render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitted++
        }}
      >
        {node}
      </form>
    )
  )
const byTestId = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!
const form = () => container.querySelector("form")!
const describedIds = (el: HTMLElement) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
const before = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

/** ชื่อที่เข้าถึงได้จาก label[for] (ไม่นับข้อความใต้ aria-hidden) — ไม่มี @testing-library ใน repo */
function accessibleName(control: HTMLElement) {
  const label = container.querySelector(`label[for="${control.id}"]`)
  const text = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? node.textContent ?? ""
      : (node as Element).getAttribute?.("aria-hidden") === "true"
        ? ""
        : Array.from(node.childNodes).map(text).join("")
  return label ? text(label).trim() : ""
}

const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))
  })

/** คีย์บอร์ด: เปิดด้วย Enter บน trigger แล้วกด Enter บน item ที่ต้องการ */
function chooseByKeyboard(testId: string, value: string) {
  key(byTestId(testId), "Enter")
  expect(byTestId(testId).getAttribute("aria-expanded")).toBe("true")
  const item = document.querySelector(`[data-testid="${testId}-options"] [data-testid="${testId}-option"][data-value="${value}"]`)!
  key(item, "Enter")
}

const triggerText = (testId: string) => byTestId(testId).querySelector('[data-slot="select-value"]')!.textContent

describe("AC-40 select ของ shadcn ประกอบตาม docs ใน <form>", () => {
  it("label ก่อน trigger, role=combobox ชื่อ ประเทศ, aria-required, * อยู่ใน aria-hidden", () => {
    render(<CountryField />)
    const trigger = byTestId("country")
    const label = byTestId("country-label")
    expect(before(label, trigger)).toBe(true)
    expect(trigger.getAttribute("role")).toBe("combobox")
    expect(accessibleName(trigger)).toBe("ประเทศ")
    expect(trigger.getAttribute("aria-required")).toBe("true")
    expect(label.querySelector('[aria-hidden="true"]')?.textContent).toBe("*")
    expect(trigger.hasAttribute("data-placeholder")).toBe(true)
    expect(triggerText("country")).toBe("เลือกประเทศ")
  })

  it("renderToString มีข้อความของค่าที่เลือก (children ของ SelectValue)", () => {
    const html = renderToString(
      <form>
        <CountryField defaultValue="la" />
      </form>
    )
    expect(html).toContain("ลาว")
    expect(html).not.toContain("เลือกประเทศ")
  })

  it("defaultValue เข้า FormData และ trigger data-value = ค่านั้น", () => {
    render(<CountryField defaultValue="th" />)
    expect(new FormData(form()).get("country_code")).toBe("th")
    expect(byTestId("country").getAttribute("data-value")).toBe("th")
    expect(triggerText("country")).toBe("ไทย")
  })

  it("เลือก item ด้วยคีย์บอร์ด → FormData = ค่า, data-value = ค่า, ข้อความ trigger = ข้อความของ item ใน FormData", () => {
    render(<CountryField defaultValue="th" />)
    chooseByKeyboard("country", "mm")
    const fd = new FormData(form()).get("country_code")
    expect(fd).toBe("mm")
    expect(byTestId("country").getAttribute("aria-expanded")).toBe("false")
    expect(byTestId("country").getAttribute("data-value")).toBe("mm")
    // เปิดอีกครั้งเพื่ออ่านข้อความของ item ที่มี data-value = ค่าใน FormData
    key(byTestId("country"), "Enter")
    const item = document.querySelector(`[data-testid="country-option"][data-value="${fd}"]`)!
    expect(triggerText("country")).toBe(item.textContent)
    expect(triggerText("country")).toBe("เมียนมา")
  })
})

describe("AC-41 useFieldError กับ select (กฎ 43)", () => {
  it("required ว่าง → requestSubmit ไม่ส่ง, invalid defaultPrevented, error ไทย, data-invalid, aria-invalid/describedby, focus trigger; เลือกค่าแล้ว error หาย", () => {
    submitted = 0
    render(<CountryField />)
    const hidden = byTestId("country").closest('[data-slot="field"]')!.querySelector("select")!
    const events: Event[] = []
    hidden.addEventListener("invalid", (e) => events.push(e))
    act(() => form().requestSubmit())
    expect(submitted).toBe(0)
    expect(events.length).toBe(1)
    expect(events[0].defaultPrevented).toBe(true)
    const trigger = byTestId("country")
    const error = byTestId("country-error")
    expect(error.textContent).toBe("กรุณาเลือกประเทศ")
    expect(trigger.closest('[data-slot="field"]')!.getAttribute("data-invalid")).toBe("true")
    expect(trigger.getAttribute("aria-invalid")).toBe("true")
    expect(describedIds(trigger)).toContain(error.id)
    expect(document.activeElement).toBe(trigger)

    chooseByKeyboard("country", "th")
    expect(document.querySelector('[data-testid="country-error"]')).toBeNull()
    expect(trigger.hasAttribute("aria-invalid")).toBe(false)
    expect(trigger.closest('[data-slot="field"]')!.hasAttribute("data-invalid")).toBe(false)
    act(() => form().requestSubmit())
    expect(submitted).toBe(1)
  })

  it("สองช่องผิด → focus trigger ของช่องแรกตามลำดับ DOM และทั้งสองแสดง error", () => {
    render(
      <>
        <CountryField testId="a" name="a" />
        <CountryField testId="b" name="b" />
      </>
    )
    act(() => form().requestSubmit())
    expect(document.activeElement).toBe(byTestId("a"))
    expect(byTestId("a-error").textContent).toBe("กรุณาเลือกประเทศ")
    expect(byTestId("b-error").textContent).toBe("กรุณาเลือกประเทศ")
  })

  it("select ผิดก่อน Input ที่ผิด → focus trigger (ช่องแรกตามลำดับ DOM ข้ามชนิด control)", () => {
    render(
      <>
        <CountryField />
        <Input label="ชื่อ" name="first_name" required data-testid="first-name" />
      </>
    )
    act(() => form().requestSubmit())
    expect(document.activeElement).toBe(byTestId("country"))
    expect(byTestId("first-name-error").textContent).toBe("กรุณากรอกชื่อ")
  })

  it("prop error ของผู้เรียกแสดงแบบเดียวกัน", () => {
    render(<CountryField defaultValue="th" error="ส่งไปประเทศนี้ไม่ได้" />)
    const trigger = byTestId("country")
    const error = byTestId("country-error")
    expect(error.textContent).toBe("ส่งไปประเทศนี้ไม่ได้")
    expect(trigger.getAttribute("aria-invalid")).toBe("true")
    expect(describedIds(trigger)).toContain(error.id)
  })
})
