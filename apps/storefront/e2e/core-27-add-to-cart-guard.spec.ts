import { Page, Request } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-27 (spec 01 กฎข้อ 83, AC-119): คลิกปุ่มเพิ่มลงตะกร้าบน PDP สองครั้งติดกัน (ใน task เดียวของ browser) ต้องยิง
// server action `addToCart` ครั้งเดียว — ทั้ง `add-product-button` (1280px) และ `mobile-cart-button` (375×812)
// ข้อมูลตั้งต้นจาก seed (CORE-2): t-shirt; หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-27" } })

const PRODUCT = "t-shirt"
/** ช่วงคงที่หลัง network idle ก่อนนับ — ให้ action ที่ยิงซ้อน (ถ้ามี) มีเวลาออกจาก browser */
const SETTLE_MS = 1_000

/** server action `addToCart` เท่านั้น: POST ที่มี header `next-action` และ body เป็น argument ของ `addToCart`
 * (`[{ variantId, quantity, countryCode }]`) — PDP ยังมี server action อื่น (เช่นข้อมูล flash ที่ส่ง variant id) ซึ่งไม่นับ */
function isAddToCartAction(req: Request) {
  if (req.method() !== "POST" || !req.headers()["next-action"]) return false
  try {
    const [arg] = JSON.parse(req.postData() ?? "")
    return (
      typeof arg?.variantId === "string" &&
      typeof arg?.quantity === "number" &&
      arg?.countryCode === CC
    )
  } catch {
    return false
  }
}

/** นับ request ของ `addToCart` และติดตาม server action ที่ยังค้าง — เรียกก่อนคลิก */
function trackActions(page: Page) {
  const seen: string[] = []
  const pending = new Set<Request>()
  page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) pending.add(req)
    if (isAddToCartAction(req)) seen.push(req.headers()["next-action"])
  })
  const done = (req: Request) => pending.delete(req)
  page.on("requestfinished", done)
  page.on("requestfailed", done)
  return { seen, pending }
}

/** "network idle" ของ server action: ไม่มี action ค้าง → รอช่วงคงที่ → ยังไม่มีค้าง
 * (ไม่ใช้ `waitForLoadState("networkidle")` เพราะหน้าที่ล็อกอินแล้วมี request ค้างจน networkidle ไม่จบ — ดู thai-ui-cart-order) */
async function settle(page: Page, pending: Set<Request>) {
  await expect.poll(() => pending.size, { timeout: 15_000 }).toBe(0)
  await page.waitForTimeout(SETTLE_MS)
  await expect.poll(() => pending.size, { timeout: 15_000 }).toBe(0)
}

/** quantity ของ line ใน cart ปัจจุบันของ browser (cookie `_medusa_cart_id`) อ่านด้วย token ของเจ้าของ cart */
async function cartQuantities(page: Page, customer: Customer, pk: string) {
  const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  const res = await page.request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.status()).toBe(200)
  return ((await res.json()).cart.items as { quantity: number }[]).map((i) => i.quantity)
}

const cases = [
  { name: "desktop 1280px", button: "add-product-button", viewport: { width: 1280, height: 720 } },
  { name: "มือถือ 375×812", button: "mobile-cart-button", viewport: { width: 375, height: 812 } },
] as const

for (const c of cases) {
  test.describe(c.name, () => {
    test.use({ viewport: c.viewport })

    test(`AC-119: click() ${c.button} สองครั้งติดกัน → addToCart 1 ครั้ง quantity 1; คลิกอีกครั้งหลังจบ → 2`, async ({
      page,
      context,
      request,
      baseURL,
      step,
      evidence,
    }) => {
      const pk = await publishableKey(request, await adminHeaders(request))
      const customer = await createCustomer(request, pk)
      await signInAs(context, baseURL!, customer)
      const button = page.getByTestId(c.button)

      /** ปุ่มพร้อมกด — แถบล่างมือถือแสดงเฉพาะเมื่อฟอร์มหลักพ้นจอ (CORE-25 กฎข้อ 78) และ RSC refresh หลังเพิ่มตะกร้า
       * เลื่อนหน้ากลับขึ้นบน จึงเลื่อนไปท้ายหน้าทุกครั้งก่อนกด */
      const ready = async () => {
        if (c.button === "mobile-cart-button") {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        }
        await expect(button).toBeVisible()
        await expect(button).toBeEnabled({ timeout: 10_000 })
      }

      await step(`เปิด PDP (ล็อกอินแล้ว) → ${c.button} กดได้`, async () => {
        await page.goto(`/${CC}/products/${PRODUCT}`)
        await expect(page.getByTestId("add-product-button")).toBeEnabled({ timeout: 10_000 })
        await ready()
      })

      const { seen, pending } = trackActions(page)
      await settle(page, pending)

      await step("el.click() สองครั้งใน task เดียว → request ของ addToCart = 1 และ quantity = 1", async () => {
        await ready()
        await page.evaluate((testid) => {
          const el = document.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!
          el.click()
          el.click()
        }, c.button)
        await settle(page, pending)
        expect(seen, "จำนวน server action addToCart").toHaveLength(1)
        expect(await cartQuantities(page, customer, pk)).toEqual([1])
        await ready()
        await evidence(`${c.button}-01-double-click-once`)
      })

      await step("click() ปกติอีกครั้งหลัง request แรกจบ → request = 2 และ quantity = 2", async () => {
        await button.click()
        await settle(page, pending)
        expect(seen, "จำนวน server action addToCart").toHaveLength(2)
        expect(new Set(seen).size, "เป็น action เดียวกัน").toBe(1)
        expect(await cartQuantities(page, customer, pk)).toEqual([2])
      })
    })
  })
}
