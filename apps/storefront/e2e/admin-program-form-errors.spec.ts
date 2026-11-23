import { ADMIN_UI_OPTIONS, fillDatePicker, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"

// ADM-42 (spec 08 กฎ 46, AC-47): ฟอร์ม Create program กด Save ครั้งเดียวด้วยค่าที่ผิดหลายช่อง → error ใต้ทุกช่องที่ผิดพร้อมกัน
// (รวม ends_at < starts_at และ scope ว่าง) ไม่ใช่ทีละช่อง และไม่มี POST; นับ request ด้วย page.on("request")
// ปุ่ม Create program ใน action ของ DataTable หาด้วย role + ชื่อภายใน wrapper ที่มี testid (ADR-018)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-42" },
})

const PROGRAMS = "/admin/affiliate/programs"

test("AC-47: ฟอร์ม Create program ว่าง + ends_at < starts_at กด Save ครั้งเดียว → error ใต้ name, commission, ends_at และ scope พร้อมกัน ไม่มี POST", async ({
  page,
  step,
  evidence,
}) => {
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname.startsWith(PROGRAMS)) posts.push(req.url())
  })
  const field = (key: string) => page.getByTestId(`affiliate-program-field-${key}`)
  const error = (key: string) => page.getByTestId(`affiliate-program-error-${key}`)

  await step("เปิดฟอร์ม Create program กรอกแค่วันสิ้นสุดก่อนวันเริ่ม และปิด All products", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
    await fillDatePicker(field("starts_at"), "2026-12-31T10:00")
    await fillDatePicker(field("ends_at"), "2026-12-01T10:00")
    await page.getByTestId("affiliate-program-scope-all").click()
  })

  await step("กด Save ครั้งเดียว → error ทุกช่องที่ผิดแสดงพร้อมกัน", async () => {
    await page.getByTestId("affiliate-program-save").click()
    await expect(error("name")).toHaveText("Name is required")
    await expect(error("ends_at")).toHaveText("End must be after start")
    await expect(error("commission_value")).toHaveText("Commission must be above 0 and at most 100")
    await expect(error("collection_ids")).toHaveText("Select at least one collection or category")
    await expect(page.locator('[data-testid^="affiliate-program-error-"]:visible')).toHaveCount(4)
    await evidence("01-program-form-all-errors")
    expect(posts).toEqual([])
  })

  await step("แก้เฉพาะชื่อแล้วกด Save อีกครั้ง → error ของชื่อหาย ช่องที่ยังผิดคงแสดงครบ และยังไม่มี POST", async () => {
    await field("name").fill(`ADM-42 ${Date.now()}`)
    await page.getByTestId("affiliate-program-save").click()
    await expect(error("ends_at")).toBeVisible()
    await expect(error("commission_value")).toBeVisible()
    await expect(error("collection_ids")).toBeVisible()
    await expect(error("name")).toHaveCount(0)
    expect(posts).toEqual([])
  })
})
