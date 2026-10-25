import { BACKEND_URL, expect, test } from "./support/fixtures"

// CORE-5: smoke ที่ไม่ต้องใช้ข้อมูลสินค้า (seed มาใน CORE-2) — ยืนยันว่า Playwright,
// screenshot ทุก step และการบันทึก evidence ทำงานได้ end-to-end
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-5" } })

test("storefront เสิร์ฟ robots.txt ได้", async ({ page, step, evidence }) => {
  await step("เปิด /robots.txt", async () => {
    const res = await page.goto("/robots.txt")
    expect(res?.status()).toBe(200)
  })

  await step("มีกฎ disallow หน้า checkout", async () => {
    await expect(page.locator("body")).toContainText("Disallow: /*/checkout")
    await evidence("01-storefront-robots")
  })
})

test("backend /health ตอบ 200 และหน้า login ของ admin แสดงผล", async ({
  page,
  request,
  step,
  evidence,
}) => {
  await step("GET /health ตอบ 200", async () => {
    const res = await request.get(`${BACKEND_URL}/health`)
    expect(res.status()).toBe(200)
  })

  await step("เปิดหน้า login ของ admin", async () => {
    await page.goto(`${BACKEND_URL}/app/login`)
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await evidence("02-admin-login")
  })
})
