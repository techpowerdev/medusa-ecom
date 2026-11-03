import type { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-23c: spec 01 กฎข้อ 74, AC-112 (qa/review #154, #150, qa #164 O-2)
// หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-23c" } })

const PAGE_CRASH_TEXT = "This page couldn't load"

/** server action (POST + header next-action) ของหน้า `path` → ตอบ 500 หรือ abort ระดับ network */
async function failServerAction(page: Page, path: string, mode: "500" | "network") {
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const req = route.request()
      if (req.method() === "POST" && req.headers()["next-action"]) {
        if (mode === "500") {
          await route.fulfill({ status: 500, body: "Internal Server Error" })
        } else {
          await route.abort("failed")
        }
        return
      }
      await route.continue()
    }
  )
}

const ADDRESS = {
  "first-name-input": "สมหญิง",
  "last-name-input": "รักดี",
  "address-1-input": "99 ถนนสุขุมวิท",
  "postal-code-input": "10110",
  "city-input": "วัฒนา",
  "state-input": "กรุงเทพมหานคร",
  "phone-input": "0812345678",
}

async function expectValues(scope: Locator, values: Record<string, string>) {
  for (const [testId, value] of Object.entries(values)) {
    await expect(scope.getByTestId(testId), testId).toHaveValue(value)
  }
}

test.describe("AC-112", () => {
  let pk: string

  test.beforeEach(async ({ request }) => {
    pk = await publishableKey(request, await adminHeaders(request))
  })

  test("เพิ่มที่อยู่ล้ม (500) → ค่าที่พิมพ์ยังอยู่และ error ไทย", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const modal = page.getByTestId("add-address-modal")

    await step("เปิดฟอร์มเพิ่มที่อยู่ กรอกครบ และ mock server action ให้ตอบ 500", async () => {
      await page.goto(`/${CC}/account/addresses`)
      await page.getByTestId("add-address-button").click()
      await expect(modal).toBeVisible()
      for (const [testId, value] of Object.entries(ADDRESS)) {
        await modal.getByTestId(testId).fill(value)
      }
      await modal.getByTestId("country-select").selectOption(CC)
      await failServerAction(page, `/${CC}/account/addresses`, "500")
    })

    await step("บันทึก → error ไทยในฟอร์ม ค่าที่พิมพ์ไม่ถูกล้าง", async () => {
      await modal.getByTestId("save-button").click()
      const error = modal.getByTestId("address-error")
      await expect(error).toBeVisible()
      await expect(error).toHaveText(THAI)
      await expectValues(modal, ADDRESS)
      await expect(modal.getByTestId("country-select")).toHaveValue(CC)
      await expect(page.getByText(PAGE_CRASH_TEXT)).toHaveCount(0)
      await evidence("01-add-address-failed-keeps-values")
    })
  })

  test("แก้ที่อยู่ล้ม (500) → ค่าที่พิมพ์ยังอยู่และ error ไทย", async ({
    page,
    context,
    request,
    baseURL,
    step,
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
    const modal = page.getByTestId("edit-address-modal")

    await step("เปิดฟอร์มแก้ที่อยู่ แก้ค่า และ mock server action ให้ตอบ 500", async () => {
      await page.goto(`/${CC}/account/addresses`)
      await page.getByTestId("address-edit-button").click()
      await expect(modal).toBeVisible()
      for (const [testId, value] of Object.entries(ADDRESS)) {
        await modal.getByTestId(testId).fill(value)
      }
      await failServerAction(page, `/${CC}/account/addresses`, "500")
    })

    await step("บันทึก → error ไทยในฟอร์ม ค่าที่แก้ไม่ถูกล้าง", async () => {
      await modal.getByTestId("save-button").click()
      const error = modal.getByTestId("address-error")
      await expect(error).toBeVisible()
      await expect(error).toHaveText(THAI)
      await expectValues(modal, ADDRESS)
      await expect(page.getByText(PAGE_CRASH_TEXT)).toHaveCount(0)
    })
  })

  test("ที่อยู่ใบเสร็จ: action ล้มระดับ network → ยังเห็นฟอร์มพร้อม error ไทย", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const billing = page.getByTestId("account-billing-address-editor")
    const values = {
      "billing-first-name-input": "สมหญิง",
      "billing-last-name-input": "รักดี",
      "billing-phone-input": "0812345678",
      "billing-address-1-input": "99 ถนนสุขุมวิท",
      "billing-postcal-code-input": "10110",
      "billing-city-input": "วัฒนา",
    }

    await step("เปิด editor ที่อยู่ใบเสร็จ กรอกครบ และ mock server action ให้ล้มระดับ network", async () => {
      await page.goto(`/${CC}/account/profile`)
      await billing.getByTestId("edit-button").click()
      await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
      for (const [testId, value] of Object.entries(values)) {
        await billing.getByTestId(testId).fill(value)
      }
      await billing.getByTestId("billing-country-code-select").selectOption(CC)
      await failServerAction(page, `/${CC}/account/profile`, "network")
    })

    await step("บันทึก → error ไทยในฟอร์ม ไม่ใช่หน้า error ทั้งหน้า", async () => {
      await billing.getByTestId("save-button").click()
      const error = billing.getByTestId("error-message")
      await expect(error).toHaveCSS("opacity", "1")
      await expect(error).toHaveText(THAI)
      await expect(page.getByText(PAGE_CRASH_TEXT)).toHaveCount(0)
      await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
      await expectValues(billing, values)
      await error.scrollIntoViewIfNeeded()
      await evidence("02-billing-network-failed-inline-error")
    })
  })

  test("กดแก้ไขแล้วพิมพ์ทันที → input มีค่าที่พิมพ์", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const billing = page.getByTestId("account-billing-address-editor")
    const typed = "สมหญิง"

    await step("กดแก้ไขแล้ว type ทันทีโดยไม่รอ animation", async () => {
      await page.goto(`/${CC}/account/profile`)
      await billing.getByTestId("edit-button").click()
      await billing.getByTestId("billing-first-name-input").pressSequentially(typed)
      await expect(billing.getByTestId("billing-first-name-input")).toHaveValue(typed)
    })
  })

  test("/th/account ไม่มี 404 ใต้ /th/ และลิงก์บริการลูกค้าชี้ /contact", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const notFound: string[] = []
    page.on("response", (res) => {
      const url = new URL(res.url())
      if (res.status() === 404 && url.pathname.startsWith(`/${CC}/`)) {
        notFound.push(url.pathname)
      }
    })

    await step("เปิด /th/account รอ prefetch ของลิงก์ แล้วตรวจ href", async () => {
      await page.goto(`/${CC}/account`)
      const link = page.getByTestId("account-help-link").locator("a")
      await link.scrollIntoViewIfNeeded()
      await page.waitForLoadState("networkidle")
      await expect(link).toHaveAttribute("href", /\/contact$/)
      expect(notFound).toEqual([])
    })
  })
})
