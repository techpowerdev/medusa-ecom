import { BACKEND_URL, expect, test } from "./support/fixtures"
import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { adminHeaders } from "./support/medusa"

// ADM-2b (spec 08 AC-3, กฎ 5, 12): วันเวลาใน admin แสดงด้วย useDate ของ Medusa ตาม timezone ของ browser
// (ADMIN_UI_OPTIONS ตั้ง timezoneId Asia/Bangkok) — รูปแบบมาจากภาษาของ admin (English → enUS) จึงไม่เปลี่ยนภาษาก่อน assert
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-2b" } })

const ENDS_AT = "2026-01-31T17:30:00.000Z" // = 1 ก.พ. 2026 00:30 เวลาไทย

test("AC-3: ends_at ของแคมเปญแสดง Feb 1, 2026 12:30 AM ตามเวลาไทยของ browser", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) ใช้เวลารวมเกิน 30s ได้ในเครื่อง/CI
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  // draft ตั้ง ends_at ในอดีตได้ (ตรวจ ends_at > now ตอน activate เท่านั้น)
  const res = await request.post(`${BACKEND_URL}/admin/group-buy/campaigns`, {
    headers: admin,
    data: {
      name: `ADM-2b dates ${Date.now()}`,
      target_type: "orders",
      target_value: 3,
      group_mode: "pool",
      team_duration_hours: null,
      ends_at: ENDS_AT,
      application_method: { type: "percentage", target_type: "items", allocation: "each", max_quantity: 10, value: 10 },
    },
  })
  expect(res.status(), "create campaign").toBe(200)
  const id: string = (await res.json()).campaign.id
  const saved = await request.get(`${BACKEND_URL}/admin/group-buy/campaigns/${id}`, { headers: admin })
  expect(new Date((await saved.json()).campaign.campaign.ends_at).toISOString(), "ends_at ที่บันทึก").toBe(ENDS_AT)

  await step("เปิด /group-buying/:id → แถว Ends แสดงวันเวลาไทย", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
    const endsAt = page.getByTestId("gb-campaign-row-ends_at")
    await expect(endsAt).toBeVisible({ timeout: 30_000 })
    await expect(endsAt).toContainText("Feb 1, 2026")
    await expect(endsAt).toContainText("12:30 AM")
    await evidence("01-campaign-ends-at-bangkok")
  })
})
