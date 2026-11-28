import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI (spec 09 กฎ 17, AC-17): ที่ 390×844 หน้าหลักของร้านไม่ล้นแนวนอน (scrollWidth <= innerWidth)
// สร้างใน SFUI-1a และทุก task ของ SFUI รันซ้ำ — ลูกค้าที่ login แล้ว + cart มีสินค้า 1 ชิ้น
test.use({
  viewport: { width: 390, height: 844 },
  evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-1a" },
})

const PRODUCT = "t-shirt"

test("AC-17: หน้าแรก, store, PDP, cart, checkout, account, orders ที่ 390px ไม่ล้นแนวนอน", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("ใส่สินค้า 1 ชิ้นลงตะกร้าจาก PDP", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await addToCartFromPdp(page, { request, pk, customer })
  })

  const pages = [
    { name: "home", path: `/${CC}` },
    { name: "store", path: `/${CC}/store` },
    { name: "pdp", path: `/${CC}/products/${PRODUCT}`, evidenceName: "01-pdp-390" },
    { name: "cart", path: `/${CC}/cart` },
    { name: "checkout", path: `/${CC}/checkout?step=address`, evidenceName: "02-checkout-390" },
    { name: "account", path: `/${CC}/account` },
    { name: "orders", path: `/${CC}/account/orders` },
  ]

  for (const { name, path, evidenceName } of pages as { name: string; path: string; evidenceName?: string }[]) {
    await step(`${name}: ${path} ไม่ล้นแนวนอน`, async () => {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      const { scrollWidth, innerWidth } = await page.evaluate(async () => {
        await document.fonts.ready
        return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }
      })
      expect.soft(scrollWidth, `${path}: scrollWidth`).toBeLessThanOrEqual(innerWidth)
      if (evidenceName) await evidence(evidenceName)
    })
  }
})
