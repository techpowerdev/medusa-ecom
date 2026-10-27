import { expect, test } from "./support/fixtures"
import { THAI } from "./support/thai-text"

// CORE-15 (spec 01 กฎข้อ 29, AC-54, AC-55, AC-69): หน้า store เมื่อ /store/search ล้ม + ป้ายช่วงราคาเป็น ฿
// ต้องมี backend ที่ seed แล้ว (CORE-2) และ index ของ product สร้างเสร็จ
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-15" } })

const SEARCH_ROUTE = "**/store/search**"
const THB_LABEL = /^฿[\d,]+(\.\d{2})?$/

test("AC-54, AC-55: /store/search ตอบ 500 → หยุดยิงซ้ำ แสดง products-error ไทย และกลับมาปกติเมื่อ search ใช้ได้", async ({
  page,
  step,
  evidence,
}) => {
  const searchRequests: string[] = []
  const pageErrors: Error[] = []
  page.on("request", (req) => {
    if (req.url().includes("/store/search")) searchRequests.push(req.url())
  })
  page.on("pageerror", (err) => pageErrors.push(err))

  await page.route(SEARCH_ROUTE, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ type: "unknown_error", message: "boom" }),
    })
  )

  await step("AC-54: เปิด /th/store ขณะ search ตอบ 500 แล้วรอ 6 วินาที", async () => {
    await page.goto("/th/store")
    await expect(page.getByTestId("products-error")).toBeVisible()
    await page.waitForTimeout(6_000)
  })

  await step("AC-54: ยิง /store/search ไม่เกิน 3 ครั้ง, products-error เป็นไทย, ไม่มี pageerror", async () => {
    expect(searchRequests.length).toBeGreaterThan(0)
    expect(searchRequests.length).toBeLessThanOrEqual(3)
    const error = page.getByTestId("products-error")
    await expect(error).toBeVisible()
    expect((await error.textContent()) ?? "").toMatch(THAI)
    await expect(page.getByTestId("products-list")).toHaveCount(0)
    expect(pageErrors.map((e) => e.message)).toEqual([])
    await evidence("01-store-search-error")
  })

  await step("AC-55: ยกเลิก mock แล้ว reload → เห็นการ์ดสินค้า ไม่มี products-error", async () => {
    await page.unroute(SEARCH_ROUTE)
    await page.reload()
    await expect(
      page.getByTestId("products-list").getByTestId("product-wrapper").first()
    ).toBeVisible()
    await expect(page.getByTestId("products-error")).toHaveCount(0)
    await evidence("02-store-search-recovered")
  })
})

test.describe("AC-69: browser locale en-US", () => {
  test.use({ locale: "en-US" })

  test("ป้ายช่วงราคาใต้ slider แสดง ฿ ไม่มี THB ทั้งก่อนและหลังลาก", async ({
    page,
    step,
    evidence,
  }) => {
    const minLabel = page.getByTestId("price-range-min")
    const maxLabel = page.getByTestId("price-range-max")

    const expectThbLabels = async () => {
      for (const label of [minLabel, maxLabel]) {
        const text = ((await label.textContent()) ?? "").trim()
        expect(text).not.toContain("THB")
        expect(text).toMatch(THB_LABEL)
      }
    }

    await step("เปิด /th/store และรอ slider ราคา", async () => {
      await page.goto("/th/store")
      await expect(page.getByTestId("price-range")).toBeVisible()
      await expect(minLabel).toBeVisible()
      await expect(maxLabel).toBeVisible()
    })

    const before = { min: "", max: "" }
    await step("ก่อนลาก: ป้ายต่ำสุด/สูงสุดเป็น ฿", async () => {
      await expectThbLabels()
      before.min = (await minLabel.textContent()) ?? ""
      before.max = (await maxLabel.textContent()) ?? ""
    })

    await step("ลาก thumb ต่ำสุดไปทางขวา → ป้ายยังเป็น ฿", async () => {
      const track = await page.getByTestId("price-range").boundingBox()
      const thumb = await page
        .getByTestId("price-range")
        .getByRole("slider")
        .first()
        .boundingBox()
      expect(track && thumb).toBeTruthy()
      const y = thumb!.y + thumb!.height / 2
      await page.mouse.move(thumb!.x + thumb!.width / 2, y)
      await page.mouse.down()
      await page.mouse.move(track!.x + track!.width * 0.4, y, { steps: 10 })
      await page.mouse.up()

      await expect(minLabel).not.toHaveText(before.min)
      await expectThbLabels()
      await evidence("03-price-range-thb-en-us")
    })
  })
})
