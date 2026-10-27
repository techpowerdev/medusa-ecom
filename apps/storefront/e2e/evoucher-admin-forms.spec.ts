import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// EV-9 (spec 02 กฎข้อ 11, AC-20): ฟอร์ม partner/pool ใน admin กัน double-submit และ Label ผูก htmlFor/id
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — input หาด้วย getByLabel ตามที่ AC-20 กำหนด
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-9" } })

const PARTNERS_PATH = "/admin/evoucher/partners"

const PARTNER_LABELS = ["Name *", "Logo URL", "Terms URL", "Support contact"]
const POOL_LABELS = [
  "Partner *",
  "Name *",
  "How to use * (shown in the delivery email)",
  "Face value",
  "Validity note",
  "Low-stock threshold",
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(request: APIRequestContext, headers: Headers, path: string, data?: object): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-20: dblclick Save ของ Create partner → POST 1 ครั้ง partner ใหม่ 1 แถว; input ของฟอร์ม partner/pool หาได้ด้วย getByLabel", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `EV-9 partner ${Date.now()}`

  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === PARTNERS_PATH) posts.push(req.url())
  })
  // หน่วง response ของ POST แรกไว้จนกว่า test ปล่อย เพื่อพิสูจน์ว่าปุ่ม disabled ระหว่างรอ
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  let heldOnce = false
  await page.route(`**${PARTNERS_PATH}`, async (route) => {
    if (route.request().method() === "POST" && !heldOnce) {
      heldOnce = true
      await held
    }
    await route.continue()
  })

  await step("เปิดฟอร์ม Create partner → ทุก input หาได้ด้วย label", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await page.getByRole("button", { name: "Create partner" }).click()
    for (const label of PARTNER_LABELS) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }
    await page.getByLabel("Name *", { exact: true }).fill(name)
  })

  await step("dblclick Save → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ แล้วมี partner ใหม่ 1 แถว", async () => {
    const save = page.getByRole("button", { name: "Save" })
    await save.dblclick()
    await expect(save).toBeDisabled()
    await evidence("01-partner-save-disabled")
    expect(posts).toHaveLength(1)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === PARTNERS_PATH
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(page.getByText(name, { exact: true })).toHaveCount(1)
    expect(posts).toHaveLength(1)
    const { partners } = await call(request, admin, `${PARTNERS_PATH}?limit=100&order=-created_at`)
    expect(partners.filter((p: { name: string }) => p.name === name)).toHaveLength(1)
  })

  await step("ฟอร์ม Create pool บนหน้า variant → ทุก input หาได้ด้วย label", async () => {
    const { product } = await call(request, admin, "/admin/products", {
      title: `EV-9 voucher ${Date.now()}`,
      options: [{ title: "Value", values: ["500"] }],
      variants: [{ title: "500 THB", options: { Value: "500" }, prices: [{ currency_code: "thb", amount: 500 }] }],
    })
    await page.goto(`${BACKEND_URL}/app/products/${product.id}/variants/${product.variants[0].id}`)
    await page.getByRole("button", { name: "Create pool" }).click()
    for (const label of POOL_LABELS) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }
    await evidence("02-pool-form-labels")
  })
})
