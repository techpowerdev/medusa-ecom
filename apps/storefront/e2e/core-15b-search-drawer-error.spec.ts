import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-15b (spec 01 กฎข้อ 76, AC-114): search drawer ที่ header เมื่อ /store/search ล้ม
// ต้องมี backend + storefront ที่ทำงานอยู่ (ไม่ต้องมีสินค้า — request ค้นหาถูก mock)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-15b" } })

const SEARCH_ROUTE = "**/store/search**"
const LOG_PREFIX = "[search-drawer]"

test("AC-114: /store/search ตอบ 500 → search drawer แสดง search-drawer-error ไทย ไม่มี pageerror และ console.error 1 บรรทัดต่อ search ที่ล้ม", async ({
  page,
  step,
  evidence,
}) => {
  const pageErrors: Error[] = []
  const drawerLogs: string[] = []
  let failedSearches = 0
  page.on("pageerror", (err) => pageErrors.push(err))
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes(LOG_PREFIX)) {
      drawerLogs.push(msg.text())
    }
  })

  await page.route(SEARCH_ROUTE, (route) => {
    failedSearches += 1
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ type: "unknown_error", message: "boom" }),
    })
  })

  await step("เปิดหน้าแรกแล้วกดค้นหาที่ header", async () => {
    await page.goto(`/${CC}`)
    await page.getByTestId("nav-search-button").click()
    await expect(page.getByTestId("search-drawer")).toBeVisible()
  })

  await step("พิมพ์คำค้น → เห็น search-drawer-error ข้อความไทย", async () => {
    await page.getByTestId("search-input").fill("shirt")
    const error = page.getByTestId("search-drawer-error")
    await expect(error).toBeVisible()
    expect((await error.textContent()) ?? "").toMatch(THAI)
    await expect(page.getByTestId("search-results")).toHaveCount(0)
    await evidence("01-search-drawer-error")
  })

  await step("ไม่มี pageerror และ console.error ของ drawer 1 บรรทัดต่อ search ที่ล้ม", async () => {
    // เผื่อ error ที่ InstantSearch โยนแบบ async หลัง render
    await page.waitForTimeout(1_000)
    expect(pageErrors.map((e) => e.message)).toEqual([])
    // InstantSearch ยิง search ตอนเปิด drawer (query ว่าง) และหลังพิมพ์ — แต่ละครั้งที่ล้ม log 1 บรรทัด ไม่มี stack
    expect(failedSearches).toBeGreaterThan(0)
    expect(drawerLogs).toHaveLength(failedSearches)
    for (const line of drawerLogs) expect(line).not.toContain("\n")
  })
})
