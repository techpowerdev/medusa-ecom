import { Locator, expect } from "@playwright/test"

// CORE-90 (spec 01 กฎข้อ 146b, AC-187): ลิงก์ที่หน้าตาเป็นปุ่มต้องเป็นจุดหยุดของ Tab จุดเดียว
// (ไม่ซ้อน <button> ใน <a> — เดิม Tab หยุดที่ <a> แล้วหยุดซ้ำที่ <button> ข้างใน)
// focus ที่ลิงก์ (เหมือน Tab มาจาก element ก่อนหน้า) แล้วกด Tab หนึ่งครั้ง → focus ต้องออกจากลิงก์ไปแล้ว
export async function expectSingleTabStop(link: Locator) {
  await link.focus()
  await expect(link).toBeFocused()
  await link.page().keyboard.press("Tab")
  const stillInside = await link.evaluate(
    (el) => el === document.activeElement || el.contains(document.activeElement)
  )
  expect(stillInside, "Tab จากลิงก์ต้องไม่หยุดซ้ำที่ element ข้างในลิงก์").toBe(
    false
  )
}
