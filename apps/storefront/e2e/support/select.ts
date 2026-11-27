import { Locator, expect } from "@playwright/test"

// SFUI-15 (spec 09 กฎ 48; ADR-033 D7): โต้ตอบกับ select ของ shadcn (Radix) ด้วย testid เท่านั้น
// trigger = `<t>` (มี `data-value` = ค่าปัจจุบัน), กล่องรายการ = `<t>-options`, item = `<t>-option` + `data-value`
// แทน `selectOption`/`toHaveValue`/อ่าน `<option>` ของ `<select>` native และ loop "เลือกซ้ำจน hydrate" เดิม

async function parts(trigger: Locator) {
  const testId = await trigger.getAttribute("data-testid")
  if (!testId) throw new Error("trigger ของ select ต้องมี data-testid")
  const options = trigger.page().getByTestId(`${testId}-options`)
  return { options, items: options.locator(`[data-testid="${testId}-option"]`), testId }
}

/** คลิก trigger ซ้ำจน `aria-expanded="true"` (ก่อน hydrate คลิกแล้วไม่เปิด) */
async function open(trigger: Locator) {
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 })
  }).toPass()
}

/**
 * เปิดแล้วคลิก item ที่ `data-value` = value จากนั้นรอ `data-value` ของ trigger เปลี่ยน
 * `waitValue: false` (SFUI-16c): controlled ที่ server อาจปฏิเสธค่า (จำนวนในตะกร้า — stock ไม่พอ/ต้อง login ใหม่) ค่าคงเดิม — ผู้เรียกรอผลเอง
 */
export async function chooseOption(trigger: Locator, value: string, { waitValue = true } = {}) {
  const { options, testId } = await parts(trigger)
  await open(trigger)
  await options.locator(`[data-testid="${testId}-option"][data-value="${value}"]`).click()
  if (waitValue) await expect(trigger).toHaveAttribute("data-value", value)
}

export async function expectSelected(trigger: Locator, value: string) {
  await expect(trigger).toHaveAttribute("data-value", value)
}

/** เปิด-อ่าน-`Escape`: placeholder (ข้อความบน trigger เมื่อยังไม่เลือก ไม่งั้น null) และ item `[value, ข้อความ, disabled]` ตามลำดับ */
export async function selectOptions(trigger: Locator) {
  const { options, items } = await parts(trigger)
  const placeholder = (await trigger.getAttribute("data-placeholder")) !== null ? (await trigger.textContent())?.trim() ?? "" : null
  await open(trigger)
  await expect(options).toBeVisible()
  const list = await items.evaluateAll((els) =>
    els.map((el) => [el.getAttribute("data-value") ?? "", (el.textContent ?? "").trim(), el.hasAttribute("data-disabled")] as const)
  )
  await trigger.page().keyboard.press("Escape")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  return { placeholder, options: list as [string, string, boolean][] }
}
