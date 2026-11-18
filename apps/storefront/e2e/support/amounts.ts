import { Locator } from "@playwright/test"

import { expect } from "./fixtures"

// CORE-67 (nit review #412): helper เทียบตัวเลขราคาในแถวสินค้า — เดิมซ้ำใน core-65 และ core-66 (ผู้ใช้ที่ 3 = core-67)

/** ส่วนต่างที่ยอมรับ = ครึ่งหนึ่งของหลักสุดท้ายที่แสดง (ปัด 2 ตำแหน่ง) + epsilon ของ float — `toBeCloseTo(v, 2)` ล้มเมื่อต่าง .005 พอดี */
const TOLERANCE = 0.005 + 1e-6

/** ตัวเลขในข้อความ (ตัดสัญลักษณ์สกุลเงิน, จุลภาค, ป้าย) */
export const amountOf = (text: string) => Number(text.replace(/[^0-9.]/g, ""))

/** `actual` ห่างจาก `expected` ไม่เกินการปัดแสดงผล 2 ตำแหน่ง */
export function expectAmountClose(actual: number, expected: number, what: string) {
  expect(Math.abs(actual - expected), `${what}: ${actual} ≈ ${expected}`).toBeLessThanOrEqual(TOLERANCE)
}

/** จำนวน element = จำนวนค่าที่คาด (รวมที่ซ่อน) และทุกตัว visible พร้อมตัวเลขใกล้ค่าที่คาดตามลำดับ ([] = ไม่มี element) */
export async function expectAmounts(el: Locator, expected: number[], what: string) {
  await expect(el, `${what} count`).toHaveCount(expected.length)
  const shown = (await el.filter({ visible: true }).allTextContents()).map(amountOf)
  expect(shown, `${what} visible`).toHaveLength(expected.length)
  expected.forEach((value, i) => expectAmountClose(shown[i], value, `${what} [${i}]`))
}
