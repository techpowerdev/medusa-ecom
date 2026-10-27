import crypto from "node:crypto"

import { APIRequestContext } from "@playwright/test"

import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders, createCustomer, publishableKey } from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// AF-8a (spec 05): portal affiliate ใน storefront — login/register ของตัวเอง (actor `affiliate`) และหน้า Products
// AC-9 (แท็บ now/soon, % และวันที่, ปุ่มแชร์คัดลอกลิงก์) และ AC-35 (กฎ 29: การ์ดเดียวต่อสินค้า, "สูงสุด X%")
// หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-8a" } })

const DAY = 24 * 60 * 60 * 1000
const X = "sweatshirt" // ฿990 ทุก variant (seed)
const Y = "t-shirt" // variant[0] ถูกใช้ใน e2e ของ AF-3b — ที่นี่ใช้ M/L เท่านั้น

async function variantIds(request: APIRequestContext, pk: string, handle: string) {
  const res = await request.get(`${BACKEND_URL}/store/products?handle=${handle}&fields=id,*variants`, {
    headers: { "x-publishable-api-key": pk },
  })
  const [product] = (await res.json()).products
  return Object.fromEntries(
    (product.variants as { id: string; title: string }[]).map((v) => [v.title, v.id])
  ) as Record<string, string>
}

async function createProgram(
  request: APIRequestContext,
  admin: Headers,
  data: { name: string; startsIn: number; endsIn: number; rate: number; variants: string[] }
) {
  const res = await request.post(`${BACKEND_URL}/admin/affiliate/programs`, {
    headers: admin,
    data: {
      name: data.name,
      starts_at: new Date(Date.now() + data.startsIn).toISOString(),
      ends_at: new Date(Date.now() + data.endsIn).toISOString(),
      commission_value: data.rate,
      scope: { variant_ids: data.variants },
      status: "published",
    },
  })
  expect(res.status(), `create program ${data.name}: ${await res.text()}`).toBe(200)
}

test("AF-8a: login → แท็บได้ค่าคอมตอนนี้/เร็วๆ นี้ การ์ดเดียวต่อสินค้า และแชร์ลิงก์ (AC-9, AC-35)", async ({
  page,
  context,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const ann = await createActiveAffiliate(request, admin, "e2e-af8")
  const x = await variantIds(request, pk, X)
  const y = await variantIds(request, pk, Y)
  const run = crypto.randomBytes(3).toString("hex")
  const p3 = `E2E AF-8 P3 ${run}`

  await step("โปรแกรมตาม AC-34: X อยู่ใน P1/P2/P3 และ U1/U2; Y M อยู่ใน P1, Y L อยู่ใน P2", async () => {
    const xAll = Object.values(x)
    await createProgram(request, admin, { name: `E2E AF-8 P1 ${run}`, startsIn: -DAY, endsIn: 2 * DAY, rate: 10, variants: [...xAll, y.M] })
    await createProgram(request, admin, { name: `E2E AF-8 P2 ${run}`, startsIn: -3 * DAY, endsIn: 2 * DAY, rate: 15, variants: [...xAll, y.L] })
    await createProgram(request, admin, { name: p3, startsIn: -60_000, endsIn: 2 * DAY, rate: 15, variants: xAll })
    await createProgram(request, admin, { name: `E2E AF-8 U1 ${run}`, startsIn: DAY, endsIn: 5 * DAY, rate: 5, variants: xAll })
    await createProgram(request, admin, { name: `E2E AF-8 U2 ${run}`, startsIn: 2 * DAY, endsIn: 5 * DAY, rate: 20, variants: xAll })
  })

  await step("ยังไม่ login → ไปหน้า login ของ portal (ไม่ใช่ login ของ customer)", async () => {
    await page.goto(`/${CC}/affiliate`)
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/login(\\?|$)`))
    await expectThai(page, ["affiliate-login-title"])
  })

  await step("login ด้วยอีเมล/รหัสผ่านของ affiliate → หน้า Products แท็บได้ค่าคอมตอนนี้", async () => {
    await page.getByTestId("affiliate-login-email").fill(ann.email)
    await page.getByTestId("affiliate-login-password").fill(ann.password)
    await page.getByTestId("affiliate-login-submit").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
    expect((await context.cookies()).find((c) => c.name === "_medusa_jwt")).toBeUndefined()
    await expectThai(page, ["affiliate-tab-earning", "affiliate-tab-upcoming"])
  })

  await step("AC-35: X มีการ์ดเดียว 15% ของ P3 ยอดประมาณการ ฿148.50 และไม่มี 'สูงสุด'", async () => {
    const card = page.locator(`[data-testid="affiliate-product-card"][data-handle="${X}"]`)
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("affiliate-rate")).toContainText("15%")
    await expect(card.getByTestId("affiliate-estimate")).toContainText("฿148.50")
    await expect(card.getByTestId("affiliate-program-name")).toHaveText(p3)
    await expect(card.getByTestId("affiliate-program-dates")).toBeVisible()
    await expect(card.getByTestId("affiliate-rate-varies")).toHaveCount(0)
    await expect(card.getByTestId("affiliate-estimate")).not.toContainText("สูงสุด")
  })

  await step("AC-35: Y (variant ได้อัตราต่างกัน) การ์ดเดียว แสดง 'สูงสุด 15%' และ 'สูงสุด' หน้ายอดประมาณการ", async () => {
    const card = page.locator(`[data-testid="affiliate-product-card"][data-handle="${Y}"]`)
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("affiliate-rate")).toContainText("15%")
    await expectThai(page, ["affiliate-rate-varies"])
    await expect(card.getByTestId("affiliate-rate-varies")).toContainText("สูงสุด")
    await expect(card.getByTestId("affiliate-estimate")).toContainText("สูงสุด")
    await evidence("01-earning-tab")
  })

  await step("AC-9: ปุ่มแชร์คัดลอกลิงก์รายสินค้า (browser ไม่มี Web Share → คัดลอก)", async () => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true })
    })
    const card = page.locator(`[data-testid="affiliate-product-card"][data-handle="${X}"]`)
    await card.getByTestId("affiliate-share-button").click()
    await expect(card.getByTestId("affiliate-share-status")).toHaveText(THAI)
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(new RegExp(`/r/${ann.code}\\?to=/products/${X}$`))
  })

  await step("qa #135 D2: ?page= ทศนิยม/ไม่ใช่ตัวเลข ไม่ทำให้หน้าล้ม (ปัดลง/กลับหน้า 1)", async () => {
    for (const page_ of ["1.5", "abc"]) {
      const res = await page.goto(`/${CC}/affiliate?tab=active&page=${page_}`)
      expect(res?.status(), `page=${page_}`).toBe(200)
      await expect(page.locator(`[data-testid="affiliate-product-card"][data-handle="${X}"]`)).toHaveCount(1)
    }
  })

  await step("AC-9: แท็บเร็วๆ นี้ — X การ์ดเดียวของ U1 (5%) พร้อมนับถอยหลังถึงวันเริ่ม", async () => {
    await page.getByTestId("affiliate-tab-upcoming").click()
    await expect(page).toHaveURL(/tab=upcoming/)
    const card = page.locator(`[data-testid="affiliate-product-card"][data-handle="${X}"]`)
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("affiliate-rate")).toContainText("5%")
    await expect(card.getByTestId("affiliate-share-button")).toBeVisible()
    await expectThai(page, ["affiliate-countdown"])
    await evidence("02-upcoming-tab")
  })
})

test("AF-8a: สมัคร affiliate ผ่าน portal → สถานะรออนุมัติ ยังไม่เห็นสินค้า", async ({ page, step, evidence }) => {
  const code = `e2e-af8r-${Date.now().toString(36)}${crypto.randomInt(1e6)}`

  await step("สมัครด้วยชื่อ code อีเมล รหัสผ่าน", async () => {
    await page.goto(`/${CC}/affiliate/login`)
    await page.getByTestId("affiliate-register-name").fill("ทดสอบ AF-8")
    await page.getByTestId("affiliate-register-code").fill(code)
    await page.getByTestId("affiliate-register-email").fill(`${code}@example.com`)
    await page.getByTestId("affiliate-register-password").fill(crypto.randomBytes(12).toString("hex"))
    await page.getByTestId("affiliate-register-submit").click()
  })

  await step("เข้า portal ได้ แต่แสดงข้อความรออนุมัติ (Q6: pending → products 403)", async () => {
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
    await expectThai(page, ["affiliate-status-notice"])
    await expect(page.getByTestId("affiliate-product-card")).toHaveCount(0)
    await expect(page.getByTestId("affiliate-code")).toHaveText(code)
    await evidence("03-pending")
  })

  await step("ออกจากระบบ → กลับหน้า login", async () => {
    await page.getByTestId("affiliate-logout").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/login(\\?|$)`))
  })
})

test("AF-8a: customer ที่ยังไม่สมัครแอฟฟิลิเอต login portal → ข้อความไทย ไม่ตั้ง session (review #135)", async ({
  page,
  context,
  request,
  step,
}) => {
  const admin = await adminHeaders(request)
  const customer = await createCustomer(request, await publishableKey(request, admin))

  await step("login portal ด้วยอีเมล/รหัสผ่านของ customer", async () => {
    await page.goto(`/${CC}/affiliate/login`)
    await page.getByTestId("affiliate-login-email").fill(customer.email)
    await page.getByTestId("affiliate-login-password").fill(customer.password)
    await page.getByTestId("affiliate-login-submit").click()
  })

  await step("ยังอยู่หน้า login พร้อมข้อความไทย และไม่มี cookie _affiliate_jwt", async () => {
    await expectThai(page, ["affiliate-login-error"])
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/login(\\?|$)`))
    expect((await context.cookies()).find((c) => c.name === "_affiliate_jwt")).toBeUndefined()
  })
})

test("AF-8a: affiliate ที่ถูกระงับ → ข้อความระงับ ไม่เห็นสินค้า (Q6)", async ({ page, request, step }) => {
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-af8s")
  const res = await request.post(`${BACKEND_URL}/admin/affiliate/affiliates/${ann.id}`, {
    headers: admin,
    data: { status: "suspended" },
  })
  expect(res.status(), "admin suspend affiliate").toBe(200)

  await step("login แล้วเห็นข้อความระงับ ไม่มีแท็บและการ์ด", async () => {
    await page.goto(`/${CC}/affiliate/login`)
    await page.getByTestId("affiliate-login-email").fill(ann.email)
    await page.getByTestId("affiliate-login-password").fill(ann.password)
    await page.getByTestId("affiliate-login-submit").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
    await expectThai(page, ["affiliate-status-notice"])
    await expect(page.getByTestId("affiliate-tab-earning")).toHaveCount(0)
    await expect(page.getByTestId("affiliate-product-card")).toHaveCount(0)
  })
})
