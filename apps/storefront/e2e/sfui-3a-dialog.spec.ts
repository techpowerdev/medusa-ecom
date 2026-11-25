import type { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI, latinWordsOutsideAllowList } from "./support/thai-text"

// SFUI-3a (spec 09 กฎ 4, 9, 11, AC-9): modal ที่อยู่ในหน้า address book เป็น `Dialog` ของ shadcn (Radix)
// — testid เดิมอยู่บน DialogContent (role="dialog"), มีชื่อ/คำอธิบายที่เข้าถึงได้เป็นภาษาไทย, Tab วนอยู่ใน dialog,
// Escape ปิดและ focus กลับปุ่มที่เปิด, ไม่มี warning ของ Radix เรื่อง DialogTitle / aria-describedby
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-3a" } })

const RADIX_WARNING = /DialogTitle|aria-describedby/

/** ข้อความของ element ที่ id อยู่ใน attribute (aria-labelledby / aria-describedby) ของ dialog */
async function textOfRef(page: Page, dialog: Locator, attr: string): Promise<string> {
  const ids = await dialog.getAttribute(attr)
  expect(ids, `${attr} ของ dialog`).toBeTruthy()
  const parts: string[] = []
  for (const id of ids!.split(/\s+/)) {
    parts.push(((await page.locator(`[id="${id}"]`).textContent()) ?? "").trim())
  }
  return parts.join(" ")
}

async function expectAccessibleDialog(
  page: Page,
  opener: Locator,
  testId: string
): Promise<void> {
  const dialog = page.getByRole("dialog")

  await opener.click()
  await expect(dialog).toBeVisible()
  // กฎ 9: testid เดิมอยู่บน DialogContent ซึ่งเป็น element role="dialog" ตัวเดียวกัน
  await expect(dialog).toHaveAttribute("data-testid", testId)
  await expect(dialog).toHaveAttribute("data-slot", "dialog-content")

  // กฎ 11: ชื่อและคำอธิบายที่เข้าถึงได้เป็นภาษาไทย (ไม่มีคำละตินนอกรายการยกเว้น)
  await expect(dialog).toHaveAccessibleName(THAI)
  const title = await textOfRef(page, dialog, "aria-labelledby")
  expect(title).toMatch(THAI)
  expect(latinWordsOutsideAllowList(title), `title: "${title}"`).toEqual([])
  await expect(dialog).toHaveAccessibleDescription(THAI)
  const description = await textOfRef(page, dialog, "aria-describedby")
  expect(description).toMatch(THAI)
  expect(latinWordsOutsideAllowList(description), `description: "${description}"`).toEqual([])
  // ปุ่มปิดคง testid เดิมและมีชื่อภาษาไทย (ปุ่ม icon อย่างเดียว — กฎ 6)
  await expect(dialog.getByTestId("close-modal-button")).toHaveAccessibleName(THAI)

  // Tab 20 ครั้ง focus ยังอยู่ใน dialog (focus trap)
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab")
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement))
    expect(inside, `Tab ครั้งที่ ${i + 1} focus ต้องอยู่ใน dialog`).toBe(true)
  }

  // Escape ปิด และ focus กลับปุ่มที่เปิด
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId(testId)).toHaveCount(0)
  await expect(opener).toBeFocused()
}

test.describe("AC-9", () => {
  let pk: string
  let warnings: string[]

  test.beforeEach(async ({ page, request }) => {
    pk = await publishableKey(request, await adminHeaders(request))
    warnings = []
    page.on("console", (msg) => {
      if (RADIX_WARNING.test(msg.text())) warnings.push(msg.text())
    })
  })

  test("modal เพิ่มที่อยู่: dialog มีชื่อ/คำอธิบายไทย, Tab วนใน dialog, Escape ปิดและ focus กลับปุ่ม", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const opener = page.getByTestId("add-address-button")

    await step("เปิดหน้า address book", async () => {
      await page.goto(`/${CC}/account/addresses`)
      await expect(opener).toBeVisible()
    })

    await step("เปิด dialog เพิ่มที่อยู่ ตรวจ a11y, focus trap และ Escape", async () => {
      await opener.click()
      await expect(page.getByTestId("add-address-modal")).toBeVisible()
      await evidence("01-add-address-dialog")
      await page.keyboard.press("Escape")
      await expect(page.getByTestId("add-address-modal")).toHaveCount(0)
      await expectAccessibleDialog(page, opener, "add-address-modal")
    })

    await step("ปุ่มปิด (close-modal-button) ปิด dialog", async () => {
      await opener.click()
      const modal = page.getByTestId("add-address-modal")
      await expect(modal).toBeVisible()
      await modal.getByTestId("close-modal-button").click()
      await expect(modal).toHaveCount(0)
    })

    expect(warnings, "console ของ Radix เรื่อง DialogTitle/aria-describedby").toEqual([])
  })

  test("modal แก้ไขที่อยู่: dialog มีชื่อ/คำอธิบายไทย, Tab วนใน dialog, Escape ปิดและ focus กลับปุ่ม", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    const customer = await createCustomer(request, pk)
    const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
      data: {
        first_name: "สมชาย",
        last_name: "ใจดี",
        address_1: "1 ถนนพระราม 4",
        postal_code: "10500",
        city: "บางรัก",
        province: "กรุงเทพมหานคร",
        country_code: CC,
        phone: "0800000000",
      },
    })
    expect(saved.status(), "saved address").toBe(200)
    await signInAs(context, baseURL!, customer)
    const opener = page.getByTestId("address-edit-button")

    await step("เปิดหน้า address book ที่มีที่อยู่ 1 รายการ", async () => {
      await page.goto(`/${CC}/account/addresses`)
      await expect(opener).toBeVisible()
    })

    await step("เปิด dialog แก้ไขที่อยู่ ตรวจ a11y, focus trap และ Escape", async () => {
      await opener.click()
      const modal = page.getByTestId("edit-address-modal")
      await expect(modal).toBeVisible()
      await expect(modal.getByTestId("first-name-input")).toHaveValue("สมชาย")
      await evidence("02-edit-address-dialog")
      await page.keyboard.press("Escape")
      await expect(modal).toHaveCount(0)
      await expectAccessibleDialog(page, opener, "edit-address-modal")
    })

    expect(warnings, "console ของ Radix เรื่อง DialogTitle/aria-describedby").toEqual([])
  })
})
