import { Page, Route } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-5 (spec 08 AC-8, กฎ 9–11) + spec 02 กฎข้อ 26 (follow-up EV-14 #195): ตาราง Partners ของหน้า E-vouchers
// เป็น DataTable ของ dashboard (หน้าใน URL `partners_offset`), Edit/Delete ต่อแถวใน ActionMenu (trigger
// `evoucher-partner-row-actions`, menuitem หาด้วย role + ชื่อตามกฎ 10) และฟอร์ม Form + zod (error ใต้ช่อง ไม่มี request)
// ปุ่ม Next ของ DataTable ใส่ testid ไม่ได้ จึงหาด้วย role + ชื่อภายในตาราง Partners (`evoucher-partners`)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-5" } })

const PARTNERS_PATH = "/admin/evoucher/partners"

const isPartnersList = (url: URL) => url.pathname === PARTNERS_PATH

const partnersRequest = (page: Page, match: (params: URLSearchParams) => boolean) =>
  page.waitForResponse((res) => {
    const url = new URL(res.url())
    return res.request().method() === "GET" && isPartnersList(url) && match(url.searchParams)
  })

/** นับ request ที่แก้ข้อมูล partner (POST/DELETE ของ /admin/evoucher/partners*) */
const countWrites = (page: Page, method: "POST" | "DELETE") => {
  const urls: string[] = []
  page.on("request", (req) => {
    if (req.method() === method && new URL(req.url()).pathname.startsWith(PARTNERS_PATH)) urls.push(req.url())
  })
  return urls
}

/** แทน GET รายการ partner ด้วยข้อมูลจำลอง (DB ของ e2e ใช้ร่วมกันทุกไฟล์ จำนวน partner จริงไม่ตายตัว) — แบ่งหน้าตาม limit/offset ของ request */
const mockPartners = (page: Page, total: number) =>
  page.route(isPartnersList, async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback()
    const params = new URL(route.request().url()).searchParams
    const limit = Number(params.get("limit"))
    const offset = Number(params.get("offset"))
    const all = Array.from({ length: total }, (_, i) => ({
      id: `evpart_mock_${String(i + 1).padStart(2, "0")}`,
      name: `Mock partner ${String(i + 1).padStart(2, "0")}`,
      logo_url: null,
      terms_url: null,
      support_contact: null,
    }))
    await route.fulfill({
      json: { partners: all.slice(offset, offset + limit), count: total, limit, offset },
    })
  })

test("AC-8: partner 25 ราย → 20 แถวหน้าแรก, 5 แถวหน้าสอง (partners_offset ใน URL); ไม่มี partner → evoucher-partners-empty", async ({
  page,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const section = page.getByTestId("evoucher-partners")
  const rows = section.locator("tbody tr")
  await loginAdmin(page)
  await mockPartners(page, 25)

  await step("เปิด /evouchers → หน้าแรก 20 แถว (limit=20, offset=0)", async () => {
    const first = partnersRequest(page, (p) => p.get("limit") === "20" && p.get("offset") === "0")
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await first
    await expect(rows).toHaveCount(20)
  })

  await step("กด Next → URL มี partners_offset=20 มี 5 แถว และ reload แล้วยังเป็นหน้าเดิม", async () => {
    const second = partnersRequest(page, (p) => p.get("offset") === "20")
    await section.getByRole("button", { name: "Next" }).click()
    await second
    await expect(page).toHaveURL(/[?&]partners_offset=20(&|$)/)
    await expect(rows).toHaveCount(5)
    await expect(rows.first()).toContainText("Mock partner 21")

    const reloaded = partnersRequest(page, (p) => p.get("offset") === "20")
    await page.reload()
    await reloaded
    await expect(page).toHaveURL(/[?&]partners_offset=20(&|$)/)
    await expect(rows).toHaveCount(5)
    await evidence("01-partners-page-2")
  })

  await step("partners_offset ที่ผิดรูปใน URL → ขอหน้าแรกและ URL ถูกแก้ (ไม่แสดง NaN)", async () => {
    const first = partnersRequest(page, (p) => p.get("offset") === "0")
    await page.goto(`${BACKEND_URL}/app/evouchers?partners_offset=abc`)
    await first
    await expect(page).not.toHaveURL(/partners_offset=/)
    await expect(rows).toHaveCount(20)
    await expect(section).not.toContainText("NaN")
  })

  await step("ไม่มี partner → evoucher-partners-empty และยังกด Create partner ได้", async () => {
    await page.unroute(isPartnersList)
    await mockPartners(page, 0)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await expect(page.getByTestId("evoucher-partners-empty")).toBeVisible()
    await expect(section.getByRole("button", { name: "Create partner" })).toBeVisible()
  })
})

test("AC-8: Create partner — ชื่อว่าง/URL ที่ไม่ใช่ http(s) → error ใต้ช่องไม่มี POST; https และช่องว่างส่งได้", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  // ขึ้นต้นด้วย "000" ให้อยู่หน้าแรกของตารางที่เรียงตามชื่อ
  const name = `000 ADM-5 create ${Date.now()}`
  const posts = countWrites(page, "POST")

  await step("เปิดฟอร์ม Create partner แล้วกด Save โดยไม่กรอกชื่อ → error ใต้ช่อง Name ไม่มี POST", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await page.getByRole("button", { name: "Create partner" }).click()
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByTestId("evoucher-partner-name-error")).toHaveText("Name is required")
    expect(posts).toHaveLength(0)
  })

  await step("terms_url = javascript:alert(1), logo_url = data:text/html,x → error ใต้ทั้งสองช่อง ไม่มี POST", async () => {
    await page.getByLabel("Name *", { exact: true }).fill(name)
    await page.getByLabel("Terms URL", { exact: true }).fill("javascript:alert(1)")
    await page.getByLabel("Logo URL", { exact: true }).fill("data:text/html,x")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByTestId("evoucher-partner-terms_url-error")).toBeVisible()
    await expect(page.getByTestId("evoucher-partner-logo_url-error")).toBeVisible()
    await expect(page.getByTestId("evoucher-partner-name-error")).toHaveCount(0)
    await evidence("02-create-partner-url-errors")
    expect(posts).toHaveLength(0)
  })

  await step("terms_url = https://example.com/terms, logo_url ว่าง → POST 1 ครั้งและเห็นแถวใหม่", async () => {
    await page.getByLabel("Terms URL", { exact: true }).fill("https://example.com/terms")
    await page.getByLabel("Logo URL", { exact: true }).fill("")
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === PARTNERS_PATH
    )
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter")
    expect((await created).status()).toBe(200)
    await expect(page.getByTestId("evoucher-partners").getByText(name, { exact: true })).toHaveCount(1)
    expect(posts).toHaveLength(1)
  })

  const { partners } = await call(request, admin, `${PARTNERS_PATH}?limit=1&order=-created_at`)
  expect(partners[0]).toMatchObject({ name, terms_url: "https://example.com/terms", logo_url: null })
  await request.delete(`${BACKEND_URL}${PARTNERS_PATH}/${partners[0].id}`, { headers: admin })
})

test("AC-8: Edit/Delete ผ่าน evoucher-partner-row-actions — URL ไม่ใช่ http(s) ไม่มี POST, ยกเลิก prompt ไม่มี DELETE", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `000 ADM-5 edit ${Date.now()}`
  const { partner } = await call(request, admin, PARTNERS_PATH, { name })
  const posts = countWrites(page, "POST")
  const deletes = countWrites(page, "DELETE")
  const row = page.getByTestId("evoucher-partners").locator("tbody tr").filter({ hasText: name })

  await step("menuitem Edit → logo_url = data:text/html,x → error ใต้ช่อง ไม่มี POST", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await row.getByTestId("evoucher-partner-row-actions").click()
    await page.getByRole("menuitem", { name: "Edit" }).click()
    await expect(page.getByLabel("Name *", { exact: true })).toHaveValue(name)
    await page.getByLabel("Logo URL", { exact: true }).fill("data:text/html,x")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByTestId("evoucher-partner-logo_url-error")).toBeVisible()
    expect(posts).toHaveLength(0)
  })

  await step("แก้เป็น https → dblclick Save → POST /partners/:id 1 ครั้ง", async () => {
    await page.getByLabel("Logo URL", { exact: true }).fill("https://example.com/logo.png")
    await page.getByLabel("Support contact", { exact: true }).fill("support@example.com")
    const updated = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === `${PARTNERS_PATH}/${partner.id}`
    )
    await page.getByRole("button", { name: "Save" }).dblclick()
    expect((await updated).status()).toBe(200)
    await expect(row).toContainText("support@example.com")
    expect(posts).toHaveLength(1)
    const { partner: saved } = await call(request, admin, `${PARTNERS_PATH}/${partner.id}`)
    expect(saved.logo_url).toBe("https://example.com/logo.png")
  })

  await step("menuitem Delete → Cancel ใน prompt → ไม่มี DELETE และแถวยังอยู่", async () => {
    await row.getByTestId("evoucher-partner-row-actions").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await evidence("03-delete-partner-prompt")
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    expect(deletes).toHaveLength(0)
    await expect(row).toHaveCount(1)
  })

  await step("menuitem Delete → ยืนยัน → DELETE 1 ครั้งและแถวหายไป", async () => {
    await row.getByTestId("evoucher-partner-row-actions").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const removed = page.waitForResponse((res) => res.request().method() === "DELETE")
    await page.getByRole("button", { name: "Delete" }).click()
    expect((await removed).status()).toBe(200)
    await expect(row).toHaveCount(0)
    expect(deletes).toHaveLength(1)
  })
})
