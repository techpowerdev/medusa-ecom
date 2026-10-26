import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// GB-6b2 (spec 04 กฎข้อ 15–17, AC-32, AC-33): ฟอร์มสร้างแคมเปญ group buying ใน Medusa admin
// admin UI เป็นภาษาอังกฤษ — หา element ด้วย data-testid ตาม spec
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "group-buying", taskId: "GB-6b2" } })

const CAMPAIGNS_PATH = "/admin/group-buy/campaigns"

type CampaignPost = {
  max_units_per_person: number | null
  application_method: {
    max_quantity: number
    target_rules?: { attribute: string; operator: string; values: string[] }[]
  }
}

/** POST ที่ส่งไปสร้างแคมเปญ (เก็บ body ไว้ตรวจ) */
function campaignPosts(page: Page) {
  const bodies: CampaignPost[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === CAMPAIGNS_PATH) {
      bodies.push(req.postDataJSON())
    }
  })
  return bodies
}

/** datetime-local (ICT) ห่างจากตอนนี้ `hours` ชั่วโมง */
const ictLocal = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000 + 7 * 3_600_000).toISOString().slice(0, 16)

async function openCreateForm(page: Page) {
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/group-buying`)
  await page.getByTestId("gb-campaign-create").click()
  await expect(page.getByTestId("gb-campaign-create-submit")).toBeVisible()
}

async function fillValidForm(page: Page, name: string) {
  const fields: Record<string, string> = {
    name,
    target_value: "3",
    ends_at: ictLocal(48),
    discount_value: "10",
    max_quantity: "10",
  }
  for (const [key, value] of Object.entries(fields)) {
    await page.getByTestId(`gb-field-${key}`).fill(value)
  }
}

async function createProduct(request: APIRequestContext, admin: Headers, title: string): Promise<string> {
  const get = async (path: string) => (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const res = await request.post(`${BACKEND_URL}/admin/products`, {
    headers: admin,
    data: {
      title,
      status: "published",
      shipping_profile_id: shipping_profiles[0].id,
      options: [{ title: "Default", values: ["Default"] }],
      variants: [
        { title: "Default", options: { Default: "Default" }, prices: [{ currency_code: "thb", amount: 100 }] },
      ],
    },
  })
  expect(res.status(), "create product").toBe(200)
  return (await res.json()).product.id
}

test("AC-32: max_quantity < max_units_per_person ไม่ส่ง, ends_at อดีตเตือนแต่ส่งได้, dblclick ส่ง POST 1 ครั้ง", async ({
  page,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const name = `GB-6b2 form ${Date.now()}`
  const posts = campaignPosts(page)

  // หน่วง response ของ POST แรกไว้จนกว่า test ปล่อย เพื่อพิสูจน์ว่าปุ่ม disabled ระหว่างรอ (กฎข้อ 17)
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  let heldOnce = false
  await page.route(`**${CAMPAIGNS_PATH}`, async (route) => {
    if (route.request().method() === "POST" && !heldOnce) {
      heldOnce = true
      await held
    }
    await route.continue()
  })

  await step("max_quantity=1, max_units_per_person=2 แล้ว submit → gb-max-quantity-error และไม่มี POST", async () => {
    await openCreateForm(page)
    await fillValidForm(page, name)
    await page.getByTestId("gb-field-max_quantity").fill("1")
    await page.getByTestId("gb-field-max_units_per_person").fill("2")
    await page.getByTestId("gb-campaign-create-submit").click()
    await expect(page.getByTestId("gb-max-quantity-error")).toBeVisible()
    await evidence("01-max-quantity-error")
    expect(posts).toHaveLength(0)
  })

  await step("max_quantity=2 → error หาย; ends_at อดีต → gb-ends-at-warning", async () => {
    await page.getByTestId("gb-field-max_quantity").fill("2")
    await expect(page.getByTestId("gb-max-quantity-error")).toHaveCount(0)
    await expect(page.getByTestId("gb-ends-at-warning")).toHaveCount(0)
    await page.getByTestId("gb-field-ends_at").fill(ictLocal(-1))
    await expect(page.getByTestId("gb-ends-at-warning")).toBeVisible()
    await evidence("02-ends-at-warning")
  })

  await step("dblclick submit → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ แล้วแคมเปญ draft ใหม่ 1 แถว", async () => {
    const submit = page.getByTestId("gb-campaign-create-submit")
    await submit.dblclick()
    await expect(submit).toBeDisabled()
    expect(posts).toHaveLength(1)
    expect(posts[0].application_method.max_quantity).toBe(2)
    expect(posts[0].max_units_per_person).toBe(2)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(page.getByTestId("gb-campaign-create-submit")).toHaveCount(0)
    const row = page.locator("tbody tr").filter({ hasText: name })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText("draft")
    expect(posts).toHaveLength(1)
  })
})

test("AC-33: เลือกสินค้า 2 ตัวผ่าน gb-product-picker (ค้นหาด้วยชื่อ) → target_rules ใน body", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const token = `GB6b2pick${Date.now()}`
  const ids = [await createProduct(request, admin, `${token} Alpha`), await createProduct(request, admin, `${token} Beta`)]
  const posts = campaignPosts(page)
  const picker = page.getByTestId("gb-product-picker")

  await step("ฟอร์มไม่มีช่องกรอก product ID แบบข้อความอิสระ", async () => {
    await openCreateForm(page)
    await fillValidForm(page, `GB-6b2 picker ${token}`)
    await expect(page.getByTestId("gb-field-product_ids")).toHaveCount(0)
    await expect(page.getByText("Product IDs")).toHaveCount(0)
  })

  await step("ค้นหาด้วยชื่อแล้วเลือก 2 ตัว", async () => {
    await picker.getByRole("searchbox").fill(token)
    const rows = picker.locator("tbody tr")
    await expect(rows).toHaveCount(2)
    for (const label of ["Alpha", "Beta"]) {
      await rows.filter({ hasText: `${token} ${label}` }).getByRole("checkbox").click()
    }
    await expect(page.getByTestId("gb-product-picker-count")).toContainText("2")
    for (const label of ["Alpha", "Beta"]) {
      await expect(rows.filter({ hasText: `${token} ${label}` }).getByRole("checkbox")).toBeChecked()
    }
    await evidence("03-product-picker")
  })

  await step("submit → body ของ POST มี target_rules items.product.id in [id1, id2]", async () => {
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    await page.getByTestId("gb-campaign-create-submit").click()
    expect((await response).status()).toBe(200)
    expect(posts).toHaveLength(1)
    const rules = posts[0].application_method.target_rules ?? []
    expect(rules).toHaveLength(1)
    expect(rules[0]).toEqual({ attribute: "items.product.id", operator: "in", values: expect.any(Array) })
    expect([...rules[0].values].sort()).toEqual([...ids].sort())
  })
})
