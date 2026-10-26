import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// FS-10 (spec 03 กฎข้อ 15, AC-16): ปุ่ม Save ของ widget "Flash sale options" ส่ง POST .../config
// ครั้งเดียวต่อการกด แม้ dblclick (สองคลิกใน tick เดียว) และปุ่ม disabled จน response กลับ
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย role/label ของ Medusa admin
test.use({
  evidenceTarget: { feature: "flash-sale", taskId: "FS-10" },
  // backend ที่ `medusa start` (production) ตั้ง session cookie ของ admin เป็น Secure และเชื่อ proxy (trust proxy 1)
  // CI/local เป็น http จึงจำลอง proxy ที่ terminate TLS แบบ prod ไม่เช่นนั้น Set-Cookie ไม่ถูกส่งและ login admin UI ไม่ติด
  extraHTTPHeaders: { "x-forwarded-proto": "https" },
})

const env = (key: string, fallback: string) => {
  const value = process.env[key] ?? process.env[fallback]
  if (!value) throw new Error(`ต้องตั้ง env ${key} หรือ ${fallback} สำหรับ e2e`)
  return value
}

test("AC-16: dblclick Save ส่ง POST config ครั้งเดียว และ Save ซ้ำได้หลัง response กลับ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) ใช้เวลารวมเกิน 30s ได้ในเครื่อง/CI
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const created = await request.post(`${BACKEND_URL}/admin/campaigns`, {
    headers: admin,
    data: { name: "FS-10 dblclick", campaign_identifier: `fs10-${Date.now()}` },
  })
  expect(created.status(), "create campaign").toBe(200)
  const campaignId: string = (await created.json()).campaign.id
  const configPath = `/admin/flash-sales/${campaignId}/config`

  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === configPath) {
      posts.push(req.url())
    }
  })
  // หน่วง response ของ POST แรกไว้จนกว่า test จะปล่อย เพื่อพิสูจน์ว่าปุ่ม disabled ระหว่างรอ
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

  await step("ล็อกอิน admin แล้วเปิดหน้า Campaign detail", async () => {
    await page.goto(`${BACKEND_URL}/app/login`)
    await page.locator('input[name="email"]').fill(env("E2E_ADMIN_EMAIL", "SEED_ADMIN_EMAIL"))
    await page
      .locator('input[name="password"]')
      .fill(env("E2E_ADMIN_PASSWORD", "SEED_ADMIN_PASSWORD"))
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url) => !url.pathname.startsWith("/app/login"))
    await page.goto(`${BACKEND_URL}/app/campaigns/${campaignId}`)
    await expect(page.getByRole("heading", { name: "Flash sale options" })).toBeVisible()
  })

  const widget = page.locator("div", {
    has: page.getByRole("heading", { name: "Flash sale options", level: 2 }),
  })
  const drawer = page.getByRole("dialog")
  const save = drawer.getByRole("button", { name: "Save" })

  await step("dblclick Save → POST 1 ครั้ง และปุ่ม disabled ระหว่างรอ response", async () => {
    await widget.getByRole("button", { name: "Edit" }).last().click()
    await drawer.getByLabel("Per-customer limit").fill("2")
    await save.dblclick()
    await expect(save).toBeDisabled()
    await evidence("01-save-disabled-in-flight")
    expect(posts).toHaveLength(1)
  })

  await step("response กลับ → drawer ปิด ค่าที่บันทึกแสดงใน widget", async () => {
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === configPath
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(drawer).toBeHidden()
    expect(posts).toHaveLength(1)
  })

  await step("Save อีกครั้งหลัง response กลับ → ส่งได้ตามปกติ", async () => {
    await widget.getByRole("button", { name: "Edit" }).last().click()
    await drawer.getByLabel("Total cap").fill("10")
    await save.click()
    await expect(drawer).toBeHidden()
    expect(posts).toHaveLength(2)
    await evidence("02-saved-again")
  })
})
