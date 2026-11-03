import type { Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantIdsByOption,
} from "./support/medusa"

// CORE-25: spec 01 AC-116 (กฎข้อ 78, qa #178) — ตัวเลือกบน PDP ไม่ถูกรีเซ็ตจาก `v_id` และแถบปุ่มมือถือไม่ทับปุ่มหลัก
// ข้อมูลตั้งต้นจาก seed (CORE-2): t-shirt ไซซ์ S/M/L; หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-25" } })

const PRODUCT = "t-shirt"

/** line ของ cart ปัจจุบันใน browser (cookie `_medusa_cart_id`) อ่านด้วย token ของเจ้าของ cart */
async function cartLines(page: Page, customer: Customer, pk: string) {
  const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  const res = await page.request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.status()).toBe(200)
  const items = (await res.json()).cart.items as { variant_id: string; quantity: number }[]
  return Object.fromEntries(items.map((i) => [i.variant_id, i.quantity]))
}

const option = (page: Page, size: string) =>
  page.getByTestId("product-options").getByTestId("option-button").filter({ hasText: new RegExp(`^${size}$`) })

/**
 * กดเพิ่มแล้วรอ server action ของ add-to-cart ตอบและปุ่มกลับมากดได้
 * `immediate`: ส่ง click ตรงที่ element (ไม่รอ actionability) — หลังเพิ่มครั้งก่อน cart dropdown เปิดทับคอลัมน์ขวาของ PDP
 * ถ้า Playwright เลื่อน mouse เข้าไปรอ dropdown จะค้างเปิด (hover) และจังหวะ "กดทันที" จะหายไป
 */
async function addAndWait(page: Page, { immediate = false } = {}) {
  const done = page.waitForResponse((r) => r.request().headers()["next-action"] !== undefined)
  const button = page.getByTestId("add-product-button")
  await (immediate ? button.dispatchEvent("click") : button.click())
  await done
  await expect(button).toBeEnabled()
}

test("AC-116: เลือก S → M แล้วกดเพิ่มทันที (ไม่รอ v_id) → line ใน cart เป็น M; หลังเพิ่ม S แล้วสลับเป็น M ทันทีก็ยังได้ M", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const ids = await variantIdsByOption(request, pk, PRODUCT)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/${PRODUCT}`)
  // hydrate แล้ว = effect เขียน v_id ของตัวเลือกตั้งต้นลง URL
  await expect(page).toHaveURL(/[?&]v_id=/)

  await step("เลือก S → M แล้วกดเพิ่มทันที → cart มี M 1 ชิ้น", async () => {
    await option(page, "S").click()
    await option(page, "M").click()
    await addAndWait(page)
    expect(await cartLines(page, customer, pk)).toEqual({ [ids.M]: 1 })
  })

  // ลำดับเดียวกับ flaky core-19a:183 — RSC refresh ของ add ครั้งก่อนมาถึงหลังลูกค้าเลือกไซซ์ใหม่
  await step("เลือก S แล้วเพิ่ม → เลือก M แล้วกดเพิ่มทันที → cart มี S 1 และ M 2", async () => {
    // โหลดใหม่ให้ cart dropdown ไม่เปิดค้างจาก step ก่อน (เปิดอัตโนมัติเฉพาะเมื่อจำนวนเปลี่ยนหลังโหลด)
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await expect(page).toHaveURL(/[?&]v_id=/)
    await option(page, "S").click()
    await addAndWait(page)
    await option(page, "M").dispatchEvent("click")
    await addAndWait(page, { immediate: true })
    expect(await cartLines(page, customer, pk)).toEqual({ [ids.S]: 1, [ids.M]: 2 })
    await evidence("01-pdp-selected-size-kept")
  })
})

test.describe("viewport 375×812", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  /** กล่องของแถบมือถือที่ทับปุ่มหลัก (null = ไม่ทับ หรือปุ่มหลักไม่อยู่ในจอ) */
  const barOverMainButton = (page: Page) =>
    page.evaluate(() => {
      const main = document.querySelector('[data-testid="add-product-button"]')!.getBoundingClientRect()
      const bar = document.querySelector('[data-testid="mobile-actions"]')
      if (!bar || main.bottom <= 0 || main.top >= window.innerHeight) return null
      const b = bar.getBoundingClientRect()
      const hit = main.left < b.right && b.left < main.right && main.top < b.bottom && b.top < main.bottom
      return hit ? { main: main.toJSON(), bar: b.toJSON() } : null
    })

  test("AC-116: แถบปุ่มมือถือไม่ทับ add-product-button เมื่อปุ่มหลักอยู่ในจอ (ก่อนและหลัง hydrate)", async ({
    page,
    step,
    evidence,
  }) => {
    let release!: () => void
    const hydrate = new Promise<void>((r) => (release = r))

    await step("ก่อน hydrate (JS ยังโหลดไม่เสร็จ) เลื่อนให้ปุ่มหลักอยู่ขอบล่างจอ → ไม่มีแถบทับ", async () => {
      await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
        await hydrate
        await route.fallback()
      })
      await page.goto(`/${CC}/products/${PRODUCT}`, { waitUntil: "domcontentloaded" })
      const main = (await page.getByTestId("add-product-button").boundingBox())!
      await page.evaluate((y) => window.scrollBy(0, y), main.y + main.height - 780)
      await expect(page.getByTestId("add-product-button")).toBeInViewport()
      expect(await barOverMainButton(page)).toBeNull()
    })

    await step("หลัง hydrate: ทุกตำแหน่งที่ปุ่มหลักอยู่ในจอ แถบไม่ทับ; เลื่อนพ้นปุ่มหลัก → แถบแสดง", async () => {
      release()
      await expect(page).toHaveURL(/[?&]v_id=/)
      const top = await page.evaluate(
        () => document.querySelector('[data-testid="add-product-button"]')!.getBoundingClientRect().top + window.scrollY
      )
      for (const fromTop of [780, 600, 400, 200, 10]) {
        await page.evaluate((y) => window.scrollTo(0, y), top - fromTop)
        await expect(page.getByTestId("add-product-button")).toBeInViewport()
        await expect.poll(() => barOverMainButton(page), { message: `ปุ่มหลักที่ y=${fromTop}` }).toBeNull()
        if (fromTop === 780) await evidence("02-pdp-375-main-button-no-bar")
      }
      await page.evaluate((y) => window.scrollTo(0, y), top + 300)
      await expect(page.getByTestId("add-product-button")).not.toBeInViewport()
      await expect(page.getByTestId("mobile-actions")).toBeVisible()
      await evidence("03-pdp-375-bar-after-scroll")
    })
  })
})
