import { BACKEND_URL, expect, test } from "./support/fixtures"
import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { adminHeaders } from "./support/medusa"

// ADM-2a (spec 08 AC-5): widget "Flash sale options" ใช้ Header + SectionRow ของ Medusa — ค่าที่บันทึกแล้วแสดงตรงกับ API
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หาแถวด้วย data-testid
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-2a" } })

test("AC-5: widget flash sale ที่บันทึกแล้วแสดงค่า Total cap ตรงกับ API", async ({ page, request, step, evidence }) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) ใช้เวลารวมเกิน 30s ได้ในเครื่อง/CI
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const created = await request.post(`${BACKEND_URL}/admin/campaigns`, {
    headers: admin,
    data: { name: "ADM-2a widget", campaign_identifier: `adm2a-${Date.now()}` },
  })
  expect(created.status(), "create campaign").toBe(200)
  const campaignId: string = (await created.json()).campaign.id

  const saved = await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, {
    headers: admin,
    data: { per_customer_limit: 2, total_cap: 25, show_countdown: true },
  })
  expect(saved.status(), "save flash sale config").toBe(200)
  const fromApi = await request.get(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, { headers: admin })
  const { flash_sale_config: config } = await fromApi.json()
  expect(config.total_cap).toBe(25)

  await step("เปิดหน้า Campaign detail → แถว Total cap แสดงค่าจาก API", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/campaigns/${campaignId}`)
    const widget = page.getByTestId("flash-sale-options")
    const totalCap = widget.getByTestId("flash-sale-row-total_cap")
    await expect(totalCap).toBeVisible({ timeout: 30_000 })
    await expect(totalCap).toContainText(String(config.total_cap))
    await expect(widget.getByTestId("flash-sale-row-per_customer_limit")).toContainText("2")
    await expect(widget.getByTestId("flash-sale-row-show_countdown")).toContainText("Yes")
    await evidence("01-flash-sale-widget-section-rows")
  })
})
