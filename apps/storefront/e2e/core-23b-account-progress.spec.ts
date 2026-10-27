import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-23b: spec 01 กฎข้อ 61, AC-97 (qa/review #105)
// หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-23b" } })

const NAV_DELAY_MS = 2_000

test("AC-97: คลิกเมนู orders → account-nav-pending แสดงก่อนหน้าใหม่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  await step("เปิด /th/account แล้วหน่วง request RSC ของหน้า orders", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible()
    await expect(page.getByTestId("account-nav-pending")).toHaveCount(0)
    await page.route(
      (url) => url.pathname === `/${CC}/account/orders`,
      async (route) => {
        if (route.request().headers()["rsc"]) {
          await new Promise((r) => setTimeout(r, NAV_DELAY_MS))
        }
        await route.continue()
      }
    )
  })

  await step("คลิก orders → progress มองเห็นก่อนหน้า orders แสดง", async () => {
    await page.getByTestId("account-nav").getByTestId("orders-link").click()
    await expect(page.getByTestId("account-nav-pending")).toBeVisible()
    await expect(page.getByTestId("orders-page-wrapper")).toHaveCount(0)
    await evidence("01-account-nav-pending")
  })

  await step("หน้า orders แสดงแล้ว progress หายไป", async () => {
    await expect(page.getByTestId("orders-page-wrapper")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("account-nav-pending")).toHaveCount(0)
  })
})

test("AC-97: บันทึกเบอร์โทรล้ม (500) → input ยังเป็นค่าที่พิมพ์", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))
  const phone = page.getByTestId("account-phone-editor")
  const typed = "0899999999"

  await step("เปิด editor เบอร์ พิมพ์ค่าใหม่ และ mock server action ให้ตอบ 500", async () => {
    await page.goto(`/${CC}/account/profile`)
    await phone.getByTestId("edit-button").click()
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await phone.getByTestId("phone-input").fill(typed)
    await page.route(
      (url) => url.pathname === `/${CC}/account/profile`,
      async (route) => {
        const req = route.request()
        if (req.method() === "POST" && req.headers()["next-action"]) {
          await route.fulfill({ status: 500, body: "Internal Server Error" })
          return
        }
        await route.continue()
      }
    )
  })

  await step("บันทึก → ข้อความ error ไทย และค่าใน input ไม่ถูกล้าง", async () => {
    await phone.getByTestId("save-button").click()
    const error = phone.getByTestId("error-message")
    await expect(error).toBeVisible()
    await expect(error).toHaveText(THAI)
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await expect(phone.getByTestId("phone-input")).toHaveValue(typed)
    await evidence("02-phone-save-failed-keeps-value")
  })
})
