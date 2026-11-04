import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-3 (spec 08 AC-6, กฎ 8): pilot ฟอร์ม Form + KeyboundForm + zod ของ dashboard — drawer "Flash sale options"
// และ modal Create pool บนหน้า variant: error ใต้ช่อง (testid), dblclick / ⌘+Enter = POST 1 ครั้ง
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา error ด้วย data-testid, input ด้วย label เดิม (กฎ 7)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-3" } })

const POOLS_PATH = "/admin/evoucher/pools"

/** นับ POST ไปยัง path ที่กำหนด (เทียบ pathname ตรง) */
const countPosts = (page: Page, path: string) => {
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) posts.push(req.url())
  })
  return posts
}

test("AC-6: drawer flash sale — Total cap 0 แสดง error ไม่ POST; dblclick Save และ Meta+Enter = POST 1 ครั้ง", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) ใช้เวลารวมเกิน 30s ได้ในเครื่อง/CI
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const created = await request.post(`${BACKEND_URL}/admin/campaigns`, {
    headers: admin,
    data: { name: "ADM-3 form pilot", campaign_identifier: `adm3-${Date.now()}` },
  })
  expect(created.status(), "create campaign").toBe(200)
  const campaignId: string = (await created.json()).campaign.id
  const configPath = `/admin/flash-sales/${campaignId}/config`
  const posts = countPosts(page, configPath)

  // หน่วง response ของ POST แรกไว้จนกว่า test ปล่อย — dblclick ต้องได้ POST เดียวระหว่างรอ
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  let heldOnce = false
  await page.route(`**${configPath}`, async (route) => {
    if (route.request().method() === "POST" && !heldOnce) {
      heldOnce = true
      await held
    }
    await route.continue()
  })

  const widget = page.getByTestId("flash-sale-options")
  const drawer = page.getByRole("dialog")
  const save = drawer.getByRole("button", { name: "Save" })
  const totalCap = drawer.getByLabel("Total cap")

  await step("ล็อกอิน admin แล้วเปิด drawer ของ widget flash sale", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/campaigns/${campaignId}`)
    await expect(page.getByRole("heading", { name: "Flash sale options" })).toBeVisible({ timeout: 30_000 })
    await widget.getByRole("button", { name: "Edit" }).click()
    await expect(drawer).toBeVisible()
  })

  await step("Total cap 0 → error ใต้ช่อง fs-total-cap-error และไม่มี POST", async () => {
    await totalCap.fill("0")
    await save.click()
    await expect(drawer.getByTestId("fs-total-cap-error")).toBeVisible()
    await expect(drawer.getByTestId("fs-total-cap-error")).toHaveText(/greater than 0/)
    await expect(totalCap).toHaveAttribute("aria-invalid", "true")
    await evidence("01-total-cap-0-error")
    expect(posts).toHaveLength(0)
  })

  await step("Total cap 10 + dblclick Save → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ", async () => {
    await totalCap.fill("10")
    await expect(drawer.getByTestId("fs-total-cap-error")).toBeHidden()
    await save.dblclick()
    await expect(save).toBeDisabled()
    expect(posts).toHaveLength(1)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === configPath
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(drawer).toBeHidden()
    await expect(widget.getByTestId("flash-sale-row-total_cap")).toContainText("10")
    expect(posts).toHaveLength(1)
  })

  await step("แก้ Total cap เป็น 11 แล้วกด Meta+Enter → POST 1 ครั้ง", async () => {
    await widget.getByRole("button", { name: "Edit" }).click()
    await expect(totalCap).toHaveValue("10")
    await totalCap.fill("11")
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === configPath
    )
    await totalCap.press("ControlOrMeta+Enter")
    const body = (await response).request().postDataJSON()
    expect(body.total_cap).toBe(11)
    await expect(drawer).toBeHidden()
    await expect(widget.getByTestId("flash-sale-row-total_cap")).toContainText("11")
    await evidence("02-saved-with-meta-enter")
    expect(posts).toHaveLength(2)
  })
})

test("AC-6: ฟอร์ม Create pool — Save โดยไม่เลือก partner → error ใต้ช่อง Partner และไม่มี POST; เลือกแล้ว dblclick = POST 1 ครั้ง", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const created = await request.post(`${BACKEND_URL}/admin/products`, {
    headers: admin,
    data: {
      title: `ADM-3 voucher ${Date.now()}`,
      options: [{ title: "Value", values: ["500"] }],
      variants: [{ title: "500 THB", options: { Value: "500" }, prices: [{ currency_code: "thb", amount: 500 }] }],
    },
  })
  expect(created.status(), "create product").toBe(200)
  const { product } = await created.json()
  const partnerRes = await request.post(`${BACKEND_URL}/admin/evoucher/partners`, {
    headers: admin,
    data: { name: `ADM-3 partner ${Date.now()}` },
  })
  expect(partnerRes.status(), "create partner").toBe(200)
  const { partner } = await partnerRes.json()
  const posts = countPosts(page, POOLS_PATH)

  await step("เปิดฟอร์ม Create pool แล้วกรอกทุกช่องยกเว้น Partner แล้วกด Save", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/products/${product.id}/variants/${product.variants[0].id}`)
    await page.getByRole("button", { name: "Create pool" }).click()
    await page.getByLabel("Name *", { exact: true }).fill("ADM-3 pool")
    await page.getByLabel("How to use * (shown in the delivery email)", { exact: true }).fill("Show the code")
    await page.getByRole("button", { name: "Save" }).click()
  })

  await step("error ใต้ช่อง Partner (evoucher-pool-partner_id-error) และไม่มี POST pools", async () => {
    await expect(page.getByTestId("evoucher-pool-partner_id-error")).toBeVisible()
    await expect(page.getByTestId("evoucher-pool-partner_id-error")).toHaveText("Select a partner")
    await expect(page.getByTestId("evoucher-pool-name-error")).toHaveCount(0)
    await expect(page.getByLabel("Partner *", { exact: true })).toHaveAttribute("aria-invalid", "true")
    await evidence("03-pool-partner-required")
    expect(posts).toHaveLength(0)
  })

  await step("เลือก partner แล้ว dblclick Save → POST 1 ครั้ง body แปลงตาม schema และ widget แสดง pool", async () => {
    await page.getByLabel("Partner *", { exact: true }).click()
    await page.getByRole("option", { name: partner.name }).click()
    await expect(page.getByTestId("evoucher-pool-partner_id-error")).toHaveCount(0)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === POOLS_PATH
    )
    await page.getByRole("button", { name: "Save" }).dblclick()
    const res = await response
    expect(res.status()).toBe(200)
    expect(res.request().postDataJSON()).toEqual({
      partner_id: partner.id,
      variant_id: product.variants[0].id,
      name: "ADM-3 pool",
      how_to_use: "Show the code",
      face_value: null,
      validity_note: null,
      low_stock_threshold: 20,
    })
    await expect(page.getByRole("link", { name: "Manage codes" })).toBeVisible()
    expect(posts).toHaveLength(1)
  })
})
