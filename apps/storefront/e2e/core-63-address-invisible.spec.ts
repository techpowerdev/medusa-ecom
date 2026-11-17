import type { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { waitForServerAction } from "./support/server-action"
import { THAI } from "./support/thai-text"

// CORE-63: spec 01 กฎข้อ 121b, AC-162 — ฟอร์มที่อยู่หน้าบัญชี ช่องบังคับที่มีแต่ zero-width → error ไทย ไม่เรียก Store API
// หา element ด้วย data-testid เท่านั้น; อักขระมองไม่เห็นเขียนเป็น escape `\uXXXX` (บทเรียน CORE-58)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-63" } })

const ZWSP = "\u200B"

const ADDRESS = {
  "first-name-input": "สมหญิง",
  "last-name-input": "รักดี",
  "address-1-input": "99 ถนนสุขุมวิท",
  "postal-code-input": "10110",
  "state-input": "กรุงเทพมหานคร",
  "phone-input": "0812345678",
}

type StoreAddress = { id: string }

async function listAddresses(request: APIRequestContext, pk: string, customer: Customer): Promise<StoreAddress[]> {
  const res = await request.get(`${BACKEND_URL}/store/customers/me/addresses`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.ok(), `GET addresses ${res.status()}`).toBe(true)
  return (await res.json()).addresses
}

test.describe("AC-162", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("เพิ่มที่อยู่: เขต/อำเภอเป็น U+200B ล้วน → error ไทย ไม่บันทึก; แก้เป็นค่าจริง → บันทึก", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const modal = page.getByTestId("add-address-modal")
    const before = await listAddresses(request, pk, customer)

    try {
      await step("เปิดฟอร์มเพิ่มที่อยู่ กรอกครบ ยกเว้นเขต/อำเภอ = U+200B", async () => {
        await page.goto(`/${CC}/account/addresses`)
        await page.getByTestId("add-address-button").click()
        await expect(modal).toBeVisible()
        for (const [testId, value] of Object.entries(ADDRESS)) {
          await modal.getByTestId(testId).fill(value)
        }
        await modal.getByTestId("city-input").fill(ZWSP)
        await modal.getByTestId("country-select").selectOption(CC)
      })

      await step("บันทึก → error ไทย modal ยังเปิด และที่อยู่ใน API ไม่เปลี่ยน", async () => {
        const saved = waitForServerAction(page)
        await modal.getByTestId("save-button").click()
        expect((await saved).status(), "server action ของ addCustomerAddress").toBe(200)
        const error = modal.getByTestId("address-error")
        await expect(error).toBeVisible()
        await expect(error).toHaveText(THAI)
        await expect(modal).toBeVisible()
        // กฎข้อ 121c: ค่าที่พิมพ์ไม่ถูกล้าง
        await expect(modal.getByTestId("city-input")).toHaveValue(ZWSP)
        expect(await listAddresses(request, pk, customer), "ไม่บันทึกที่อยู่ที่มี U+200B").toEqual(before)
        await evidence("01-account-address-zwsp-error")
      })

      await step("แก้เขต/อำเภอเป็นค่าจริงแล้วบันทึก → ที่อยู่เพิ่ม 1", async () => {
        await modal.getByTestId("city-input").fill("วัฒนา")
        const saved = waitForServerAction(page)
        await modal.getByTestId("save-button").click()
        expect((await saved).status(), "server action ของ addCustomerAddress").toBe(200)
        await expect(modal).toBeHidden()
        await expect
          .poll(async () => (await listAddresses(request, pk, customer)).length, { message: "จำนวนที่อยู่ตาม Store API" })
          .toBe(before.length + 1)
      })
    } finally {
      const known = new Set(before.map((a) => a.id))
      for (const address of await listAddresses(request, pk, customer)) {
        if (known.has(address.id)) continue
        const res = await request.delete(`${BACKEND_URL}/store/customers/me/addresses/${address.id}`, {
          headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
        })
        expect.soft(res.ok(), `ลบที่อยู่ ${address.id}: ${res.status()}`).toBe(true)
      }
    }
  })
})
