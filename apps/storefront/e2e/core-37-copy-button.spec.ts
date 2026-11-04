import { createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-37 (spec 01 กฎข้อ 95, AC-131): ปุ่มคัดลอกของการ์ด voucher — แถวรหัสไม่เยื้องเมื่อสถานะขึ้น และค่าที่ให้คัดลอกเองแยกจากข้อความนำ
test.use({
  evidenceTarget: { feature: "core", taskId: "CORE-37" },
  permissions: ["clipboard-read", "clipboard-write"],
})

const VOUCHERS_URL = `/${STOREFRONT_COUNTRY}/account/vouchers`

test("AC-131: แถวรหัสของการ์ด voucher ไม่เยื้องที่ 1280 และข้อความคัดลอกล้มไม่ล้นจอที่ 375", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const voucher = await createVoucher(request, admin, 1, { expires_at: "2099-12-31T05:00:00.000Z" })
  const a = await createCustomer(request, pk)
  const order = await placeCapturedOrder(request, admin, pk, a, voucher.variantId, 1)
  await waitDelivered(request, admin, order, 1)
  await signInAs(context, baseURL!, a)

  const card = page.getByTestId("voucher-card").first()
  const button = card.getByTestId("voucher-copy-button")
  const centerY = async (testId: string) => {
    const box = (await card.getByTestId(testId).boundingBox())!
    return box.y + box.height / 2
  }

  await step("1280: คลิกคัดลอกสำเร็จ → ปุ่มไม่ขยับ และอยู่แนวเดียวกับ voucher-code", async () => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(VOUCHERS_URL)
    await expect(button).toBeVisible()
    const before = (await button.boundingBox())!.y
    await button.click()
    await expect(card.getByTestId("voucher-copy-status")).toHaveText(THAI)
    const after = (await button.boundingBox())!.y
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
    expect(Math.abs((await centerY("voucher-code")) - (await centerY("voucher-copy-button")))).toBeLessThan(5)
    await evidence("01-voucher-copied-1280")
  })

  await step("375: writeText reject → ค่าอยู่ใน voucher-copy-status-value ที่ไม่ใช่ break-all และหน้าไม่ล้นแนวนอน", async () => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.reject(new DOMException("denied", "NotAllowedError")),
        configurable: true,
      })
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(VOUCHERS_URL)
    const code = (await card.getByTestId("voucher-code").textContent())!
    await button.click()
    const status = card.getByTestId("voucher-copy-status")
    const value = status.getByTestId("voucher-copy-status-value")
    await expect(value).toHaveCount(1)
    await expect(value).toHaveText(code)
    await expect(status).toHaveText(THAI)
    expect(await value.evaluate((el) => getComputedStyle(el).wordBreak)).not.toBe("break-all")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await evidence("02-voucher-copy-failed-375")
  })
})
