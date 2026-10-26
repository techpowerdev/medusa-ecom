import { expect, type Page } from "@playwright/test"

// CORE-4b (ADR-014 ข้อ 4): ชื่อแบรนด์/ชื่อเฉพาะที่คงเป็นตัวอักษรละตินได้ในข้อความไทย
// (ข้อมูลจาก backend เช่น ชื่อสินค้า ไม่ควรถูกส่งเข้ามาตรวจ — เลือก element ที่เป็นข้อความของ storefront เท่านั้น)
const ALLOWED = ["Medusa Store", "Medusa", "Next.js", "GitHub"]

export const THAI = /[฀-๿]/

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** คืนคำละติน ≥ 2 ตัวอักษรที่ไม่อยู่ในรายการยกเว้น (ว่าง = ผ่าน) */
export function latinWordsOutsideAllowList(text: string): string[] {
  let rest = text
  for (const name of ALLOWED) {
    rest = rest.replaceAll(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), " ")
  }
  return rest.match(/[A-Za-z]{2,}/g) ?? []
}

/** ทุก test id ต้องมองเห็นได้ มีอักษรไทย และไม่มีคำละตินนอกรายการยกเว้น */
export async function expectThai(page: Page, testIds: string[]) {
  for (const id of testIds) {
    const el = page.getByTestId(id).first()
    await expect(el, id).toBeVisible()
    const text = (await el.textContent()) ?? ""
    expect(text, id).toMatch(THAI)
    expect(latinWordsOutsideAllowList(text), `${id}: "${text}"`).toEqual([])
  }
}
