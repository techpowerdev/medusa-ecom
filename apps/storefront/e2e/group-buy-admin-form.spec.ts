import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, fillDatePicker, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// GB-6b2 (spec 04 กฎข้อ 15–17, AC-32) + GB-6e (กฎข้อ 30d, AC-50 แทน AC-33): ฟอร์มสร้างแคมเปญ group buying ใน Medusa admin
// admin UI เป็นภาษาอังกฤษ — หา element ด้วย data-testid ตาม spec
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "group-buying", taskId: "GB-6e" } })

const CAMPAIGNS_PATH = "/admin/group-buy/campaigns"

type CampaignPost = {
  idempotency_key?: string
  starts_at?: string | null
  ends_at?: string
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

/** เวลาไทย (ICT = timezone ของ test) รูป YYYY-MM-DDTHH:mm ห่างจากตอนนี้ `hours` ชั่วโมง — ค่าที่ fillDatePicker รับ */
const ictLocal = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000 + 7 * 3_600_000).toISOString().slice(0, 16)

/**
 * toast ของ Medusa (sonner) อยู่มุมขวาบนทับปุ่ม Create campaign / gb-campaign-create-submit และหยุดนับเวลาเมื่อเมาส์ชี้อยู่
 * → ย้ายเมาส์ออกแล้วรอ toast หมดก่อนคลิกปุ่มมุมขวาบน (ไม่ใช้ force)
 */
async function waitToastsGone(page: Page) {
  await page.mouse.move(0, 0)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 })
}

async function clickCreateCampaign(page: Page) {
  await waitToastsGone(page)
  // spec 08 กฎ 7c, 18: ปุ่มอยู่ใน action ของ DataTable (ไม่รับ data-testid) — หาด้วย role + ชื่อภายใน wrapper
  await page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" }).click()
}

async function openCreateForm(page: Page) {
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/group-buying`)
  await clickCreateCampaign(page)
  await expect(page.getByTestId("gb-campaign-create-submit")).toBeVisible()
}

async function fillValidForm(page: Page, name: string) {
  const fields: Record<string, string> = {
    name,
    target_value: "3",
    discount_value: "10",
    max_quantity: "10",
  }
  for (const [key, value] of Object.entries(fields)) {
    await page.getByTestId(`gb-field-${key}`).fill(value)
  }
  // ADM-7: ช่องวันเวลาเป็น DatePicker (spec 08 กฎ 7b)
  await fillDatePicker(page.getByTestId("gb-field-ends_at"), ictLocal(48))
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

/** ค้นหาด้วยชื่อใน gb-product-picker แล้วติ๊กแถวที่ชื่อตรง */
async function pickProduct(page: Page, title: string) {
  const picker = page.getByTestId("gb-product-picker")
  await picker.getByRole("searchbox").fill(title)
  const row = picker.locator("tbody tr").filter({ hasText: title })
  await expect(row).toHaveCount(1)
  await row.getByRole("checkbox").click()
  await expect(row.getByRole("checkbox")).toBeChecked()
}

test("AC-32 + AC-50: ไม่เลือกสินค้าไม่ส่ง, max_quantity < max_units_per_person ไม่ส่ง, ends_at อดีตเตือนแต่ส่งได้, dblclick ส่ง POST 1 ครั้ง", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const name = `GB-6e form ${Date.now()}`
  const productTitle = `GB6e form product ${Date.now()}`
  const productId = await createProduct(request, await adminHeaders(request), productTitle)
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

  // AC-50: ยังไม่เลือกสินค้า (เดิมฟอร์มส่งได้ = ทุกสินค้า) → error ที่ picker และไม่มี POST
  await step("ยังไม่เลือกสินค้าแล้ว submit → gb-product-required-error และไม่มี POST", async () => {
    await openCreateForm(page)
    await fillValidForm(page, name)
    await page.getByTestId("gb-campaign-create-submit").click()
    await expect(page.getByTestId("gb-product-required-error")).toBeVisible()
    await evidence("01-product-required-error")
    expect(posts).toHaveLength(0)
  })

  await step("เลือกสินค้า → error หาย; max_quantity=1, max_units_per_person=2 แล้ว submit → gb-max-quantity-error และไม่มี POST", async () => {
    await pickProduct(page, productTitle)
    await expect(page.getByTestId("gb-product-required-error")).toHaveCount(0)
    await page.getByTestId("gb-field-max_quantity").fill("1")
    await page.getByTestId("gb-field-max_units_per_person").fill("2")
    await page.getByTestId("gb-campaign-create-submit").click()
    await expect(page.getByTestId("gb-max-quantity-error")).toBeVisible()
    await evidence("02-max-quantity-error")
    expect(posts).toHaveLength(0)
  })

  await step("max_quantity=2 → error หาย; ends_at อดีต → gb-ends-at-warning", async () => {
    await page.getByTestId("gb-field-max_quantity").fill("2")
    await expect(page.getByTestId("gb-max-quantity-error")).toHaveCount(0)
    await expect(page.getByTestId("gb-ends-at-warning")).toHaveCount(0)
    await fillDatePicker(page.getByTestId("gb-field-ends_at"), ictLocal(-1))
    const warning = page.getByTestId("gb-ends-at-warning")
    await expect(warning).toBeVisible()
    // GB-N1: เป็นคำเตือน (ยังส่งได้) จึงใช้สีเตือน ไม่ใช่สี error ของ gb-max-quantity-error
    await expect(warning).not.toHaveClass(/text-ui-fg-error/)
    await expect(warning).toHaveClass(/text-ui-tag-orange-text/)
    await evidence("03-ends-at-warning")
  })

  await step("dblclick submit → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ แล้วแคมเปญ draft ใหม่ 1 แถว", async () => {
    const submit = page.getByTestId("gb-campaign-create-submit")
    await submit.dblclick()
    await expect(submit).toBeDisabled()
    expect(posts).toHaveLength(1)
    expect(posts[0].application_method.max_quantity).toBe(2)
    expect(posts[0].max_units_per_person).toBe(2)
    expect(posts[0].application_method.target_rules).toEqual([
      { attribute: "items.product.id", operator: "in", values: [productId] },
    ])
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

// AC-50 (แทน AC-33 เคสเลือก 2 สินค้า): picker เป็น single select
test("AC-50: เลือก A แล้วเลือก B ใน gb-product-picker → เหลือ B ตัวเดียว และ target_rules = [B]", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const token = `GB6epick${Date.now()}`
  const [alphaId, betaId] = [
    await createProduct(request, admin, `${token} Alpha`),
    await createProduct(request, admin, `${token} Beta`),
  ]
  const posts = campaignPosts(page)
  const picker = page.getByTestId("gb-product-picker")
  const rows = picker.locator("tbody tr")
  const checkbox = (label: string) => rows.filter({ hasText: `${token} ${label}` }).getByRole("checkbox")

  await step("ฟอร์มไม่มีช่องกรอก product ID แบบข้อความอิสระ และไม่มีช่องเลือกทั้งหน้า", async () => {
    await openCreateForm(page)
    await fillValidForm(page, `GB-6e picker ${token}`)
    await expect(page.getByTestId("gb-field-product_ids")).toHaveCount(0)
    await expect(page.getByTestId("gb-field-product_id")).toHaveCount(0)
    await expect(page.getByText("Product IDs")).toHaveCount(0)
    await picker.getByRole("searchbox").fill(token)
    await expect(rows).toHaveCount(2)
    await expect(picker.locator("thead").getByRole("checkbox")).toHaveCount(0)
  })

  await step("เลือก Alpha แล้วเลือก Beta → Beta ติ๊กอยู่ตัวเดียว", async () => {
    await checkbox("Alpha").click()
    await expect(checkbox("Alpha")).toBeChecked()
    await checkbox("Beta").click()
    await expect(checkbox("Beta")).toBeChecked()
    await expect(checkbox("Alpha")).not.toBeChecked()
    await expect(page.getByTestId("gb-product-picker-count")).toContainText("1 selected")
    await evidence("04-product-picker-single")
  })

  await step("submit → body ของ POST มี target_rules items.product.id in [Beta]", async () => {
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    await page.getByTestId("gb-campaign-create-submit").click()
    expect((await response).status()).toBe(200)
    expect(posts).toHaveLength(1)
    expect(posts[0].application_method.target_rules).toEqual([
      { attribute: "items.product.id", operator: "in", values: [betaId] },
    ])
    expect(posts[0].application_method.target_rules?.[0].values).not.toContain(alphaId)
  })
})

// AC-50 (แทน AC-33 เคสข้ามหน้า): selection เป็น id ใน state ของฟอร์ม — เลือกตัวหน้า 2 แทนตัวหน้า 1
test("AC-50: เลือกสินค้าหน้า 1 แล้วเลือกตัวหน้า 2 → หน้า 1 ไม่ติ๊กแล้ว และ target_rules = [ตัวหน้า 2]", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const token = `GB6epage${Date.now()}`
  // picker แสดงหน้าละ 5 แถว — 6 ตัวทำให้มีหน้าที่สอง
  const products: Record<string, string> = {}
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const title = `${token} P${n}`
    products[title] = await createProduct(request, admin, title)
  }
  const posts = campaignPosts(page)
  const picker = page.getByTestId("gb-product-picker")
  const rows = picker.locator("tbody tr")
  const picked: string[] = []

  await step("หน้า 1 เลือก 1 ตัว → หน้า 2 เลือก 1 ตัว → กลับหน้า 1 ตัวเดิมไม่ติ๊กแล้ว", async () => {
    await openCreateForm(page)
    await fillValidForm(page, `GB-6e paging ${token}`)
    await picker.getByRole("searchbox").fill(token)
    // รอผลค้นหา (debounce) ก่อน — หน้าแรกแบบไม่กรองก็มี 5 แถวเหมือนกัน
    await expect(rows.filter({ hasText: token })).toHaveCount(5)
    const first = rows.first()
    picked.push((await first.locator("td").nth(1).innerText()).trim())
    await first.getByRole("checkbox").click()
    await expect(page.getByTestId("gb-product-picker-count")).toContainText("1 selected")

    await picker.getByRole("button", { name: "Next" }).click()
    await expect(rows).toHaveCount(1)
    picked.push((await rows.first().locator("td").nth(1).innerText()).trim())
    await rows.first().getByRole("checkbox").click()
    await expect(rows.first().getByRole("checkbox")).toBeChecked()
    await expect(page.getByTestId("gb-product-picker-count")).toContainText("1 selected")

    await picker.getByRole("button", { name: "Prev" }).click()
    await expect(rows).toHaveCount(5)
    await expect(rows.filter({ hasText: picked[0] }).getByRole("checkbox")).not.toBeChecked()
  })

  await step("submit → target_rules มีเฉพาะตัวหน้า 2", async () => {
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    await page.getByTestId("gb-campaign-create-submit").click()
    expect((await response).status()).toBe(200)
    expect(posts[0].application_method.target_rules).toEqual([
      { attribute: "items.product.id", operator: "in", values: [products[picked[1]]] },
    ])
  })
})

// GB-13 (spec 04 กฎข้อ 33d, AC-52): key ต่อการเปิดฟอร์ม — response หาย (network error) แล้ว submit ซ้ำต้องได้แคมเปญเดิม
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test("AC-52: body มี idempotency_key รูป UUID, submit ซ้ำหลัง network error ส่ง key เดิม, เปิดฟอร์มใหม่ได้ key ใหม่", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const token = `GB13key${Date.now()}`
  const productTitle = `${token} product`
  await createProduct(request, admin, productTitle)
  const posts = campaignPosts(page)
  const submit = page.getByTestId("gb-campaign-create-submit")
  const rows = (name: string) => page.locator("tbody tr").filter({ hasText: name })

  // POST แรก: ส่งถึง backend จริง (สร้างแคมเปญแล้ว) แต่ browser ได้ network error แทน response
  let dropped = false
  await page.route(`**${CAMPAIGNS_PATH}`, async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true
      await route.fetch()
      await route.abort("failed")
      return
    }
    await route.continue()
  })

  await step("submit ครั้งแรก → network error ฟอร์มยังเปิดอยู่ และ body มี idempotency_key รูป UUID", async () => {
    await openCreateForm(page)
    await fillValidForm(page, `${token} first`)
    await pickProduct(page, productTitle)
    await submit.click()
    await expect.poll(() => posts.length).toBe(1)
    await expect(submit).toBeEnabled()
    expect(posts[0].idempotency_key).toMatch(UUID)
  })

  await step("submit ซ้ำในรอบเดิม → ส่ง key เดิม ได้ 200 และมีแคมเปญเดียว", async () => {
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    // toast "Failed to fetch" ของ step ก่อนทับปุ่ม submit มุมขวาบน
    await waitToastsGone(page)
    await submit.click()
    expect((await response).status()).toBe(200)
    expect(posts).toHaveLength(2)
    expect(posts[1].idempotency_key).toBe(posts[0].idempotency_key)
    await expect(submit).toHaveCount(0)
    await expect(rows(`${token} first`)).toHaveCount(1)
  })

  await step("ปิดแล้วเปิดฟอร์มใหม่ → key ใหม่ ได้แคมเปญใหม่", async () => {
    await clickCreateCampaign(page)
    await fillValidForm(page, `${token} second`)
    await pickProduct(page, productTitle)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    await submit.click()
    expect((await response).status()).toBe(200)
    expect(posts).toHaveLength(3)
    expect(posts[2].idempotency_key).toMatch(UUID)
    expect(posts[2].idempotency_key).not.toBe(posts[0].idempotency_key)
    await expect(rows(`${token} second`)).toHaveCount(1)
    await expect(rows(`${token} first`)).toHaveCount(1)
  })
})

// ADM-7 (spec 08 AC-10, กฎ 5): DatePicker ตีความตาม timezone ของเครื่อง (test ตั้ง Asia/Bangkok) แล้วส่ง Date → ISO UTC;
// ⌘/Ctrl+Enter (KeyboundForm) ส่งฟอร์ม 1 ครั้ง
test("AC-10: กรอก starts 2026-12-01 10:00 / ends 2026-12-31 23:30 (เวลาไทย) แล้ว Meta/Control+Enter → POST 1 ครั้ง body เป็น UTC", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(90_000)
  const token = `ADM7tz${Date.now()}`
  const productTitle = `${token} product`
  await createProduct(request, await adminHeaders(request), productTitle)
  const posts = campaignPosts(page)

  await step("กรอกฟอร์มด้วย fillDatePicker แล้วกด ControlOrMeta+Enter ในช่อง Name", async () => {
    await openCreateForm(page)
    await fillValidForm(page, `ADM-7 tz ${token}`)
    await fillDatePicker(page.getByTestId("gb-field-starts_at"), "2026-12-01T10:00")
    await fillDatePicker(page.getByTestId("gb-field-ends_at"), "2026-12-31T23:30")
    await pickProduct(page, productTitle)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === CAMPAIGNS_PATH
    )
    await page.getByTestId("gb-field-name").press("ControlOrMeta+Enter")
    expect((await response).status()).toBe(200)
    await expect(page.getByTestId("gb-campaign-create-submit")).toHaveCount(0)
  })

  await step("body ของ POST มี starts_at/ends_at เป็น UTC ของเวลาไทยที่กรอก และส่งครั้งเดียว", async () => {
    expect(posts).toHaveLength(1)
    expect(posts[0].starts_at).toBe("2026-12-01T03:00:00.000Z")
    expect(posts[0].ends_at).toBe("2026-12-31T16:30:00.000Z")
  })
})

// ADM-13 (spec 08 AC-17, กฎ 16, 18): หัวตาราง + ปุ่มสร้างอยู่ใน toolbar ของ DataTable แถวเดียวกัน (ไม่มีแถว toolbar ว่าง)
test.describe("ADM-13: หัวตารางรายการแคมเปญ", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-13" } })

  test("AC-17: heading และปุ่ม Create campaign อยู่แถวเดียวกันใน gb-campaigns-table และยังเห็นคำเตือน GBT-", async ({
    page,
    step,
    evidence,
  }) => {
    const table = page.getByTestId("gb-campaigns-table")
    const heading = table.getByRole("heading", { name: "Group-buy campaigns" })
    const create = table.getByRole("button", { name: "Create campaign" })

    await step("เปิด /app/group-buying → ใน wrapper มี heading 1 ตัว ปุ่ม 1 ตัว และเห็น gb-template-warning", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying`)
      await expect(heading).toHaveCount(1)
      await expect(create).toHaveCount(1)
      await expect(page.getByTestId("gb-template-warning")).toBeVisible()
    })

    await step("centerY ของปุ่มกับ heading ต่างกันไม่เกิน 8px", async () => {
      const [headingBox, createBox] = await Promise.all([heading.boundingBox(), create.boundingBox()])
      if (!headingBox || !createBox) throw new Error("ไม่พบตำแหน่งของ heading หรือปุ่ม Create campaign")
      const centerY = (box: { y: number; height: number }) => box.y + box.height / 2
      expect(Math.abs(centerY(createBox) - centerY(headingBox))).toBeLessThanOrEqual(8)
      await evidence("01-list-toolbar")
    })
  })
})
