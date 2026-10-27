import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// AF-2 (spec 05): ลิงก์ `/r/<code>?to=` → cookie `aff` (httpOnly) → เพิ่มสินค้า → cart metadata.affiliate_token
// เตรียมสำหรับ AC-3/AC-1 (attribution ทำใน AF-3) — หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-2" } })

const PRODUCT = "t-shirt"

test("AF-2: คลิกลิงก์ affiliate → cookie aff → เพิ่มสินค้าลง cart → metadata.affiliate_token = ค่า cookie", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { code } = await createActiveAffiliate(request, admin)
  const customer = await createCustomer(request, pk)
  let token = ""

  await step("ลิงก์ที่ไม่ active/ไม่มีอยู่ → ไปหน้าสินค้าได้แต่ไม่มี cookie aff", async () => {
    await page.goto(`/r/no-such-affiliate?to=/products/${PRODUCT}`)
    await expect(page).toHaveURL(new RegExp(`/${CC}/products/${PRODUCT}(\\?|$)`))
    expect((await context.cookies()).find((c) => c.name === "aff")).toBeUndefined()
  })

  await step("ลิงก์ ?to= ภายนอก → กลับหน้าแรกของร้าน (กัน open redirect)", async () => {
    await page.goto(`/r/${code}?to=//evil.example/x`)
    await expect(page).toHaveURL(new RegExp(`^${baseURL}/${CC}$`))
  })

  await step("คลิกลิงก์แชร์ /r/<code>?to=/products/<handle> → หน้าสินค้า + cookie aff (httpOnly)", async () => {
    await page.goto(`/r/${code}?to=/products/${PRODUCT}`)
    await expect(page).toHaveURL(new RegExp(`/${CC}/products/${PRODUCT}(\\?|$)`))
    const aff = (await context.cookies()).find((c) => c.name === "aff")
    expect(aff, "cookie aff").toBeDefined()
    expect(aff!.httpOnly).toBe(true)
    expect(aff!.sameSite).toBe("Lax")
    expect(aff!.value.split(".")).toHaveLength(3)
    token = aff!.value
  })

  await step("ล็อกอินแล้วเพิ่มสินค้า → cart ของ customer มี metadata.affiliate_token เท่ากับ cookie", async () => {
    await signInAs(context, baseURL!, customer)
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()

    await expect
      .poll(async () => {
        const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
        if (!cartId) return undefined
        const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,metadata`, {
          headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
        })
        return (await res.json()).cart?.metadata?.affiliate_token
      })
      .toBe(token)
  })
})
