import { call, createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { THAI } from "./support/thai-text"

// EV-7b (spec 02 AC-6, AC-36): บล็อกพาร์ทเนอร์บน PDP และหน้า "บัตรกำนัลของฉัน" ที่อ่านจาก GET /store/customers/me/evouchers
test.use({
  evidenceTarget: { feature: "evoucher", taskId: "EV-7b" },
  permissions: ["clipboard-read", "clipboard-write"],
})

const VOUCHERS_URL = `/${STOREFRONT_COUNTRY}/account/vouchers`
// > 7 วัน (กฎข้อ 2) — allocation เลือก code ได้ตามปกติ
const EXPIRES_AT = "2099-12-31T05:00:00.000Z"

test("AC-36: PDP ของ voucher มี evoucher-partner-block ภาษาไทย ส่วนสินค้าปกติไม่มี", async ({ page, request, step, evidence }) => {
  const admin = await adminHeaders(request)
  const voucher = await createVoucher(request, admin, 1, { validity_note: "ใช้ได้ภายใน 90 วัน" })

  await step("เปิด PDP ของ voucher → เห็นชื่อพาร์ทเนอร์ วิธีใช้ และข้อความไทย", async () => {
    await page.goto(`/${STOREFRONT_COUNTRY}/products/${voucher.handle}`)
    const block = page.getByTestId("evoucher-partner-block")
    // ระหว่าง hydrate Suspense อาจมี fallback (variant ตั้งต้น) ค้างชั่วครู่ — รอให้เหลือบล็อกเดียว
    await expect(block).toHaveCount(1)
    await expect(block).toBeVisible()
    await expect(block.getByTestId("evoucher-partner-name")).toHaveText(voucher.partnerName)
    await expect(block).toContainText("แสดง code ที่แคชเชียร์")
    await expect(block).toContainText("ใช้ได้ภายใน 90 วัน")
    await expect(block.getByTestId("evoucher-delivery-note")).toHaveText(THAI)
    await evidence("01-pdp-partner-block")
  })

  await step("PDP ของสินค้าปกติไม่มีบล็อกนี้", async () => {
    await page.goto(`/${STOREFRONT_COUNTRY}/products/t-shirt`)
    await expect(page.getByTestId("product-container").getByTestId("product-title")).toBeVisible()
    await expect(page.getByTestId("evoucher-partner-block")).toHaveCount(0)
  })
})

test("AC-6 + AC-36: บัตรกำนัลของฉันแสดงเฉพาะ code ของตนเอง พร้อมปุ่มคัดลอก", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const voucher = await createVoucher(request, admin, 3, { expires_at: EXPIRES_AT })
  const [a, b] = [await createCustomer(request, pk), await createCustomer(request, pk)]
  const orderA = await placeCapturedOrder(request, admin, pk, a, voucher.variantId, 2)
  await waitDelivered(request, admin, orderA, 2)
  const orderB = await placeCapturedOrder(request, admin, pk, b, voucher.variantId, 1)
  await waitDelivered(request, admin, orderB, 1)

  const mine = async (token: string) =>
    (
      await call(request, { authorization: `Bearer ${token}`, "x-publishable-api-key": pk }, "/store/customers/me/evouchers")
    ).evouchers as { code: string }[]
  const codesOfA = (await mine(a.token)).map((e) => e.code)
  const [codeOfB] = (await mine(b.token)).map((e) => e.code)
  expect(codesOfA).toHaveLength(2)

  await step("ไม่ล็อกอิน → หน้า login และไม่เห็น voucher-card", async () => {
    await page.goto(VOUCHERS_URL)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(page.getByTestId("voucher-card")).toHaveCount(0)
  })

  await step("A เปิด vouchers-link ใน account → เห็น code ชื่อพาร์ทเนอร์ วันหมดอายุ", async () => {
    await signInAs(context, baseURL!, a)
    await page.goto(`/${STOREFRONT_COUNTRY}/account`)
    await page.getByTestId("account-nav").getByTestId("vouchers-link").click()
    await expect(page).toHaveURL(new RegExp(`${VOUCHERS_URL}$`))
    await expect(page.getByTestId("vouchers-page-wrapper").locator("h1")).toHaveText(THAI)
    const cards = page.getByTestId("voucher-card")
    await expect(cards).toHaveCount(2)
    for (const code of codesOfA) {
      const card = cards.filter({ has: page.getByTestId("voucher-code").getByText(code, { exact: true }) })
      await expect(card.getByTestId("voucher-partner-name")).toHaveText(voucher.partnerName)
      await expect(card.getByTestId("voucher-expires-at")).toContainText("2642")
    }
    await evidence("02-my-vouchers")
  })

  await step("กด voucher-copy-button → clipboard เท่ากับ code", async () => {
    const card = page.getByTestId("voucher-card").first()
    const code = await card.getByTestId("voucher-code").textContent()
    await card.getByTestId("voucher-copy-button").click()
    await expect(card.getByTestId("voucher-copy-button")).toHaveText(THAI)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)
  })

  await step("B เห็น voucher-card 1 ใบ และหน้าไม่มี code ของ A", async () => {
    await context.clearCookies()
    await signInAs(context, baseURL!, b)
    await page.goto(VOUCHERS_URL)
    await expect(page.getByTestId("voucher-card")).toHaveCount(1)
    await expect(page.getByTestId("voucher-code")).toHaveText(codeOfB)
    const text = (await page.locator("body").textContent()) ?? ""
    for (const code of codesOfA) expect(text).not.toContain(code)
  })
})
