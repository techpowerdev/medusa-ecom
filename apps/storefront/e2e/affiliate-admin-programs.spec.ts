import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-12a (spec 05 กฎ 37a, AC-42): แท็บ Programs ของหน้า Affiliate ใน admin สร้าง/แก้/ลบโปรแกรม draft ผ่าน admin API ของ AF-5
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "affiliate", taskId: "AF-12a" } })

const DAY = 24 * 60 * 60 * 1000
const PROGRAMS_PATH = "/admin/affiliate/programs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(request: APIRequestContext, admin: Headers, path: string, data?: object): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers: admin })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-42: สร้างด้วย dblclick ยิง POST ครั้งเดียว, แก้ commission คง variant_ids, status ตามกฎ 20, ลบเฉพาะ draft ผ่าน prompt", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const tag = `${Date.now()}`
  const { products } = await call(request, admin, "/admin/products?limit=1&fields=id,variants.id")
  const variantId: string = products[0].variants[0].id

  // published ที่หน้าต่างเวลาจบไปแล้ว ไม่กระทบ portal ของ test อื่น
  const { program: published } = await call(request, admin, PROGRAMS_PATH, {
    name: `AF-12a published ${tag}`,
    starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
    ends_at: new Date(Date.now() - 20 * DAY).toISOString(),
    commission_value: 5,
    scope: { all: true },
    status: "published",
  })
  // scope.variant_ids ตั้งผ่าน API (Q16) — UI แก้ไม่ได้ แต่ต้องคงไว้
  const { program: editable } = await call(request, admin, PROGRAMS_PATH, {
    name: `AF-12a edit ${tag}`,
    starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
    ends_at: new Date(Date.now() + 20 * DAY).toISOString(),
    commission_value: 5,
    scope: { variant_ids: [variantId] },
  })
  const createdName = `AF-12a new ${tag}`

  const requests: string[] = []
  page.on("request", (req) => {
    const path = new URL(req.url()).pathname
    if (path.startsWith(PROGRAMS_PATH) && req.method() !== "GET") requests.push(`${req.method()} ${path}`)
  })
  const row = (text: string) => page.getByRole("row").filter({ hasText: text })
  const save = page.getByTestId("affiliate-program-save")
  const field = (key: string) => page.getByTestId(`affiliate-program-field-${key}`)

  await step("ends_at ก่อน starts_at → เห็น error และไม่มี POST", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await expect(row(editable.name)).toBeVisible({ timeout: 30_000 })
    await page.getByTestId("affiliate-program-create").click()
    await field("name").fill(createdName)
    await field("starts_at").fill("2030-01-10T00:00")
    await field("ends_at").fill("2030-01-01T00:00")
    await field("commission_value").fill("8")
    await save.click()
    await expect(page.getByTestId("affiliate-program-error-ends_at")).toBeVisible()
    await page.waitForTimeout(300)
    expect(requests).toEqual([])
  })

  await step("dblclick Save → POST 1 ครั้ง และแถว draft ใหม่ปรากฏโดยไม่ reload", async () => {
    await page.evaluate(() => ((window as unknown as { __af12a: boolean }).__af12a = true))
    await field("ends_at").fill("2030-02-01T00:00")
    await save.dblclick()
    await expect(row(createdName)).toBeVisible()
    await expect(row(createdName)).toContainText("draft")
    expect(requests).toEqual([`POST ${PROGRAMS_PATH}`])
    expect(await page.evaluate(() => (window as unknown as { __af12a?: boolean }).__af12a)).toBe(true)
    await evidence("01-program-created")
  })

  await step("แก้ commission_value → ค่าใหม่ใน API และ scope.variant_ids เดิมไม่เปลี่ยน", async () => {
    await row(editable.name).getByTestId("affiliate-program-edit").click()
    await expect(page.getByTestId("affiliate-program-variant-count")).toContainText("1")
    await field("commission_value").fill("12.5")
    await evidence("02-program-edit-form")
    await save.click()
    await expect(row(editable.name)).toContainText("12.5%")
    const { program } = await call(request, admin, `${PROGRAMS_PATH}/${editable.id}`)
    expect(Number(program.commission_value)).toBe(12.5)
    expect(program.scope.variant_ids).toEqual([variantId])
  })

  await step("โปรแกรม published → ตัวเลือก status ไม่มี draft และแถวไม่มีปุ่มลบ", async () => {
    await expect(row(published.name).getByTestId("affiliate-program-delete")).toHaveCount(0)
    await row(published.name).getByTestId("affiliate-program-edit").click()
    await field("status").click()
    const options = page.getByRole("option")
    await expect(options).toHaveText(["published", "ended"])
    await evidence("03-published-status-options")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    await expect(save).toBeHidden()
  })

  await step("ลบ draft: ยกเลิก prompt → ไม่มี DELETE; ยืนยัน → แถวหาย", async () => {
    const created = row(createdName)
    await created.getByTestId("affiliate-program-delete").click()
    const dialog = page.getByRole("alertdialog")
    await dialog.getByRole("button", { name: "Keep program" }).click()
    await expect(dialog).toBeHidden()
    await page.waitForTimeout(300)
    expect(requests.filter((r) => r.startsWith("DELETE"))).toHaveLength(0)

    await created.getByTestId("affiliate-program-delete").click()
    await page.waitForTimeout(300) // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence
    await evidence("04-delete-prompt")
    await dialog.getByRole("button", { name: "Delete program" }).click()
    await expect(created).toHaveCount(0)
    expect(requests.filter((r) => r.startsWith("DELETE"))).toHaveLength(1)
  })
})
