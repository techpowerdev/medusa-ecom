// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import CheckboxWithLabel from "@modules/common/components/checkbox"
import NativeSelect from "@modules/common/components/native-select"
import Input from "./index"

// SFUI-11a (spec 09 กฎ 28–30, 34, AC-27): ช่องกรอกจาก `field` ของ shadcn — render component จริง (ไม่ mock primitive — บทเรียน PAY-16)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom ไม่มี ResizeObserver (Radix Checkbox วัดขนาดปุ่มให้ input ซ่อน)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
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

const render = (node: ReactNode) => act(() => root.render(<form>{node}</form>))
const byTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<T>(`[data-testid="${id}"]`)!

/** ชื่อที่เข้าถึงได้จาก label (ข้อความของ label ที่ไม่อยู่ใต้ aria-hidden) — ไม่มี @testing-library ใน repo */
function accessibleName(control: HTMLInputElement | HTMLSelectElement | HTMLElement) {
  const label = (control as HTMLInputElement).labels?.[0] ?? container.querySelector(`label[for="${control.id}"]`)
  const text = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? node.textContent ?? ""
      : (node as Element).getAttribute?.("aria-hidden") === "true"
        ? ""
        : Array.from(node.childNodes).map(text).join("")
  return label ? text(label).trim() : ""
}

const before = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe("Input (Field ของ shadcn)", () => {
  it("label อยู่ก่อน input, labels[0] = <t>-label, ชื่อที่เข้าถึงได้ไม่มี *, ช่องบังคับมี * ใน aria-hidden", () => {
    render(<Input label="อีเมล" name="email" required data-testid="email-input" />)
    const input = byTestId<HTMLInputElement>("email-input")
    const label = byTestId("email-input-label")
    expect(input.tagName).toBe("INPUT")
    expect(before(label, input)).toBe(true)
    expect(input.labels?.[0]).toBe(label)
    expect(input.id).not.toBe("")
    expect(input.required).toBe(true)
    const star = label.querySelector('[aria-hidden="true"]')
    expect(star?.textContent).toBe("*")
    expect(accessibleName(input)).toBe("อีเมล")
    expect(label.closest('[data-slot="field"]')).toBe(input.closest('[data-slot="field"]'))
  })

  it("id ไม่ซ้ำเมื่อ render สองช่องชื่อเดียวกัน และใช้ prop id เมื่อผู้เรียกส่ง", () => {
    render(
      <>
        <Input label="ชื่อ" name="first_name" data-testid="a" />
        <Input label="ชื่อ" name="first_name" data-testid="b" />
        <Input label="โค้ดส่วนลด" name="code" id="promotion-input" data-testid="c" />
      </>
    )
    const [a, b] = [byTestId<HTMLInputElement>("a"), byTestId<HTMLInputElement>("b")]
    expect(a.id).not.toBe("")
    expect(a.id).not.toBe(b.id)
    expect(a.labels?.[0]).toBe(byTestId("a-label"))
    expect(b.labels?.[0]).toBe(byTestId("b-label"))
    expect(byTestId("c").id).toBe("promotion-input")
  })

  it("ไม่มี required → ไม่มี * และไม่มีป้ายใดๆ; placeholder ส่งถึง <input>", () => {
    render(<Input label="เบอร์โทรศัพท์" name="phone" placeholder="เช่น 0812345678" data-testid="phone-input" />)
    const label = byTestId("phone-input-label")
    expect(label.textContent).toBe("เบอร์โทรศัพท์")
    expect(label.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(byTestId("phone-input").getAttribute("placeholder")).toBe("เช่น 0812345678")
  })

  it("รหัสผ่าน: InputGroup ครอบ input, ปุ่ม <t>-toggle ชื่อไทย สลับ type และ aria-pressed", () => {
    render(<Input label="รหัสผ่าน" name="password" type="password" required data-testid="password-input" />)
    const input = byTestId<HTMLInputElement>("password-input")
    const toggle = byTestId<HTMLButtonElement>("password-input-toggle")
    expect(input.closest('[data-slot="input-group"]')).not.toBeNull()
    expect(input.labels?.[0]).toBe(byTestId("password-input-label"))
    expect(input.type).toBe("password")
    expect(toggle.type).toBe("button")
    expect(toggle.getAttribute("aria-label")).toBe("แสดงรหัสผ่าน")
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    act(() => toggle.click())
    expect(input.type).toBe("text")
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(toggle.getAttribute("aria-label")).toBe("ซ่อนรหัสผ่าน")
    expect(new FormData(container.querySelector("form")!).has("password")).toBe(true)
  })
})

describe("NativeSelect + label", () => {
  it("label ก่อน select, labels[0] = <t>-label, * ของช่องบังคับ, option ว่าง disabled ตามเดิม", () => {
    render(
      <NativeSelect label="ประเทศ" name="country_code" required placeholder="เลือกประเทศ" data-testid="country-select">
        <option value="th">ไทย</option>
      </NativeSelect>
    )
    const select = byTestId<HTMLSelectElement>("country-select")
    const label = byTestId("country-select-label")
    expect(select.tagName).toBe("SELECT")
    expect(before(label, select)).toBe(true)
    expect(select.labels?.[0]).toBe(label)
    expect(label.querySelector('[aria-hidden="true"]')?.textContent).toBe("*")
    expect(accessibleName(select)).toBe("ประเทศ")
    expect(Array.from(select.options).map((o) => [o.value, o.text, o.disabled])).toEqual([
      ["", "เลือกประเทศ", true],
      ["th", "ไทย", false],
    ])
  })

  it("placeholder={false} → ไม่ render option ว่าง (กฎ 31a)", () => {
    render(
      <NativeSelect label="จำนวน" name="quantity" placeholder={false} data-testid="q">
        <option value="1">1</option>
        <option value="2">2</option>
      </NativeSelect>
    )
    expect(Array.from(byTestId<HTMLSelectElement>("q").options).map((o) => o.value)).toEqual(["1", "2"])
    expect(byTestId("q-label").querySelector('[aria-hidden="true"]')).toBeNull()
  })
})

describe("Checkbox (Field แนวนอน)", () => {
  it("control ก่อน label, label ชี้ id ของ checkbox, id ไม่ซ้ำระหว่างสองตัว", () => {
    render(
      <>
        <CheckboxWithLabel label="ใช้ที่อยู่จัดส่งเป็นที่อยู่สำหรับออกใบเสร็จ" name="same_as_billing" data-testid="billing-address-checkbox" />
        <CheckboxWithLabel label="อีกช่อง" name="other" data-testid="other-checkbox" />
      </>
    )
    const box = byTestId("billing-address-checkbox")
    const label = byTestId("billing-address-checkbox-label")
    expect(box.closest('[data-slot="field"]')?.getAttribute("data-orientation")).toBe("horizontal")
    expect(before(box, label)).toBe(true)
    expect(box.id).not.toBe("")
    expect(label.getAttribute("for")).toBe(box.id)
    expect(byTestId("other-checkbox").id).not.toBe(box.id)
    expect(accessibleName(box)).toBe("ใช้ที่อยู่จัดส่งเป็นที่อยู่สำหรับออกใบเสร็จ")
  })
})
