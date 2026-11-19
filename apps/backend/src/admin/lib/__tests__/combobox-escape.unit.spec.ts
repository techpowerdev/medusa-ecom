import { keepModalOpenWhileComboboxExpanded } from "../combobox-escape"

// ADM-26 (spec 08 กฎ 30c): onEscapeKeyDown ของ FocusModal.Content — preventDefault เฉพาะเมื่อ Escape มาจาก input combobox ที่ขยายอยู่
const escapeFrom = (target: unknown) => {
  const event = { target, preventDefault: jest.fn() }
  keepModalOpenWhileComboboxExpanded(event as unknown as KeyboardEvent)
  return event.preventDefault
}
// แทน Element ด้วย object ที่มี closest — test รันใน node (ไม่มี DOM)
const element = (expanded: boolean) => ({
  closest: (selector: string) => (expanded && selector === '[role="combobox"][aria-expanded="true"]' ? {} : null),
})

describe("keepModalOpenWhileComboboxExpanded (spec 08 กฎ 30c)", () => {
  it("input combobox ขยายอยู่ → preventDefault (modal ไม่ปิด)", () => {
    expect(escapeFrom(element(true))).toHaveBeenCalledTimes(1)
  })

  it("ไม่มี combobox ขยาย → ไม่ preventDefault (Escape ปิด modal ตามเดิม)", () => {
    expect(escapeFrom(element(false))).not.toHaveBeenCalled()
  })

  it("target ไม่ใช่ element (null / document) → ไม่ preventDefault", () => {
    expect(escapeFrom(null)).not.toHaveBeenCalled()
    expect(escapeFrom({})).not.toHaveBeenCalled()
  })
})
