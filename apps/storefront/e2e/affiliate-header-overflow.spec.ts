import { Page } from "@playwright/test"
import crypto from "node:crypto"

import { createActiveAffiliate } from "./support/affiliate"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders } from "./support/medusa"

// AF-19 (spec 05 กฎ 43, AC-51): header ของ portal ไม่ล้นแนวนอนที่ 375/639 เมื่อชื่อละตินยาวไม่มีช่องว่าง
// ทุกหน้าที่ใช้ layout ของ portal; ที่ 1280 ชื่อสั้นยังอยู่แถวเดียวกับปุ่มออกจากระบบ — หา element ด้วย data-testid (ADR-014)
// AF-20 (กฎ 44, AC-52): ป้าย "รหัสแนะนำ" และรหัสแนะนำ 32 ตัวที่มี `-` ไม่ถูกตัดบรรทัด (Range ของเนื้อหามี 1 rect)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-19" } })

/** ชื่อละติน 76 ตัวไม่มีช่องว่าง — ยาวคงที่ทุกรอบ (ไม่สุ่มความยาว) จึงล้มทุกครั้งก่อนแก้ */
const LONG_NAME = "AF19" + "N".repeat(72)
const SHORT_NAME = "AF19 Short"

const PAGES = ["", "/programs", "/earnings", "/payouts", "/profile"]

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto(`/${CC}/affiliate/login`)
  await page.getByTestId("affiliate-login-email").fill(who.email)
  await page.getByTestId("affiliate-login-password").fill(who.password)
  await page.getByTestId("affiliate-login-submit").click()
  await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
}

const rightOf = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => el.getBoundingClientRect().right)

for (const width of [375, 639]) {
  test.describe(`AC-51 ที่ ${width}×812`, () => {
    test.use({ viewport: { width, height: 812 } })

    test(`AC-51: ชื่อละตินยาว 76 ตัว → ทุกหน้าของ portal ไม่ล้นที่ ${width}`, async ({
      page,
      request,
      step,
      evidence,
    }) => {
      expect(LONG_NAME).toHaveLength(76)
      const ann = await createActiveAffiliate(
        request,
        await adminHeaders(request),
        "e2e-af19",
        undefined,
        LONG_NAME
      )
      await login(page, ann)

      for (const path of PAGES) {
        await step(`เปิด /${CC}/affiliate${path} → header อยู่ในจอ ${width}px`, async () => {
          await page.goto(`/${CC}/affiliate${path}`)
          const name = page.getByTestId("affiliate-header-name")
          await expect(name).toHaveText(LONG_NAME)
          await expect(page.getByTestId("affiliate-code")).toBeVisible()
          await expect(page.getByTestId("affiliate-logout")).toBeVisible()
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
          expect(await rightOf(page, "affiliate-header-name")).toBeLessThanOrEqual(width)
          expect(await rightOf(page, "affiliate-code")).toBeLessThanOrEqual(width)
          expect(await rightOf(page, "affiliate-logout")).toBeLessThanOrEqual(width)
          if (width === 375 && path === "") await evidence("01-header-375")
        })
      }
    })
  })
}

test("AC-51: ที่ 1280 ชื่อสั้นอยู่แถวเดียวกับปุ่มออกจากระบบ", async ({ page, request, step }) => {
  expect(SHORT_NAME.length).toBeLessThanOrEqual(20)
  const ann = await createActiveAffiliate(
    request,
    await adminHeaders(request),
    "e2e-af19-wide",
    undefined,
    SHORT_NAME
  )
  await step("y-center ของ affiliate-header-name กับ affiliate-logout ต่างกัน < 5px", async () => {
    await login(page, ann)
    const name = page.getByTestId("affiliate-header-name")
    await expect(name).toHaveText(SHORT_NAME)
    const centerY = (testId: string) =>
      page.getByTestId(testId).evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top + r.height / 2
      })
    const [nameY, logoutY] = await Promise.all([centerY("affiliate-header-name"), centerY("affiliate-logout")])
    expect(Math.abs(nameY - logoutY)).toBeLessThan(5)
  })
})

/** a-z สุ่มยาว n ตัว (ไม่มี `-` ท้ายรหัส ตามกฎ register `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`) */
const letters = (n: number) =>
  Array.from({ length: n }, () => String.fromCharCode(97 + crypto.randomInt(26))).join("")

/** รหัสแนะนำ 32 ตัว มี `-` 3 ตัว ไม่ซ้ำต่อรอบ: `af20-<timestamp>-<a-z>-<a-z>` */
function longCode() {
  const head = `af20-${Date.now().toString(36)}-${letters(6)}-`
  return head + letters(32 - head.length)
}

/** จำนวนบรรทัดที่เนื้อหาของ element กินจริง (Range.getClientRects ของ inline = 1 rect ต่อบรรทัด) */
const lineCount = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getClientRects().length
  })

const AF20_NAME = "AF20" + "N".repeat(72)

for (const width of [375, 639]) {
  test.describe(`AC-52 ที่ ${width}×812`, () => {
    test.use({ viewport: { width, height: 812 } })

    test(`AC-52: ป้าย "รหัสแนะนำ" และรหัส 32 ตัวไม่ถูกตัดบรรทัดที่ ${width}`, async ({ page, request, step }) => {
      const code = longCode()
      expect(code).toHaveLength(32)
      expect(code).toMatch(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/)
      expect(code.split("-").length - 1).toBeGreaterThanOrEqual(3)
      const ann = await createActiveAffiliate(
        request,
        await adminHeaders(request),
        "e2e-af20",
        undefined,
        AF20_NAME,
        code
      )
      await login(page, ann)

      for (const path of ["", "/profile"]) {
        await step(`เปิด /${CC}/affiliate${path} → ป้ายและรหัสอยู่บรรทัดเดียว ไม่ล้น ${width}px`, async () => {
          await page.goto(`/${CC}/affiliate${path}`)
          await expect(page.getByTestId("affiliate-header-name")).toHaveText(AF20_NAME)
          const label = page.getByTestId("affiliate-code-label")
          await expect(label).toHaveText("รหัสแนะนำ")
          expect(await label.textContent()).toMatch(/^[\u0E00-\u0E7F]+$/)
          expect(await lineCount(page, "affiliate-code-label")).toBe(1)
          await expect(page.getByTestId("affiliate-code")).toHaveText(code)
          expect(await lineCount(page, "affiliate-code")).toBe(1)
          expect(await rightOf(page, "affiliate-code")).toBeLessThanOrEqual(width)
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        })
      }
    })
  })
}

test.describe("AC-52 ที่ 1280×800", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("AC-52: ที่ 1280 ชื่อสั้นและรหัสสั้นอยู่แถวเดียวกับปุ่มออกจากระบบ (หน้าตาเดิม)", async ({
    page,
    request,
    step,
  }) => {
    const name = "AF20 Short"
    const code = `af20-${letters(6)}`
    const ann = await createActiveAffiliate(request, await adminHeaders(request), "e2e-af20w", undefined, name, code)
    await step("y-center ของ affiliate-header-name กับ affiliate-logout ต่างกัน < 5px", async () => {
      await login(page, ann)
      await expect(page.getByTestId("affiliate-header-name")).toHaveText(name)
      await expect(page.getByTestId("affiliate-code-label")).toHaveText("รหัสแนะนำ")
      await expect(page.getByTestId("affiliate-code")).toHaveText(code)
      const centerY = (testId: string) =>
        page.getByTestId(testId).evaluate((el) => {
          const r = el.getBoundingClientRect()
          return r.top + r.height / 2
        })
      const [nameY, logoutY] = await Promise.all([centerY("affiliate-header-name"), centerY("affiliate-logout")])
      expect(Math.abs(nameY - logoutY)).toBeLessThan(5)
    })
  })
})
