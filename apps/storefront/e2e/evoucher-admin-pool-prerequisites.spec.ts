import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, adminText, loginAdmin } from "./support/admin"
import { call, createPoolReadyVariant, createVoucher } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"
import { THAI } from "./support/thai-text"

// EV-27 (spec 02 กฎข้อ 43, AC-58): widget "Voucher pool" — กด Create pool แล้วตรวจเงื่อนไขของ variant จากข้อมูลของ Medusa;
// ไม่ครบ → รายการเงื่อนไขพร้อมลิงก์ไปหน้า Medusa **แทนฟอร์ม** และไม่ยิง POST; ครบ → ฟอร์มเดิม
// ค่าที่คาดสร้างจาก `json/<lng>/ecom-evoucher.json`; heading ของ dialog หาด้วย role + ชื่อภายใน dialog (ข้อยกเว้น ADR-018)

type Lng = "en" | "th"
const text = (lng: Lng, key: string) => adminText(lng, "ecom-evoucher", key)
const prereq = (lng: Lng, key: string) => text(lng, `variantWidget.prerequisites.${key}`)

const POOLS_PATH = "/admin/evoucher/pools"
const VARIANT_TITLE = "500 THB"
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const uniqueTag = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

/** นับ POST สร้าง pool ตลอด test */
const countPosts = (page: Page) => {
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === POOLS_PATH) posts.push(req.url())
  })
  return posts
}

const expectLanguage = (lng: Lng, values: string) =>
  lng === "th" ? expect(values).toMatch(THAI) : expect(values).not.toMatch(THAI)

/** กฎ 43c: product ที่มี shipping profile Default + variant ที่ไม่ manage inventory (ไม่มี inventory item) */
async function createUnreadyVariant(request: APIRequestContext, admin: Headers) {
  const { shipping_profiles } = await call(request, admin, "/admin/shipping-profiles?type=default")
  const { product } = await call(request, admin, "/admin/products", {
    title: `EV-27 voucher ${uniqueTag()}`,
    shipping_profile_id: shipping_profiles[0].id,
    options: [{ title: "Value", values: ["500"] }],
    variants: [
      { title: VARIANT_TITLE, options: { Value: "500" }, manage_inventory: false, prices: [{ currency_code: "thb", amount: 500 }] },
    ],
  })
  return { productId: product.id as string, variantId: product.variants[0].id as string }
}

const variantUrl = (productId: string, variantId: string) => `${BACKEND_URL}/app/products/${productId}/variants/${variantId}`

function cases(lng: Lng) {
  const createTitle = () => text(lng, "variantWidget.createTitle").replace("{{title}}", VARIANT_TITLE)
  const heading = (page: Page) => page.getByRole("dialog").getByRole("heading", { name: createTitle(), exact: true })
  const openCheck = async (page: Page) => {
    const opener = page.getByTestId("evoucher-pool-create")
    await expect(opener).toBeEnabled()
    await opener.click()
    await expect(heading(page)).toBeVisible()
  }

  test("(a)+(b) เงื่อนไขไม่ครบ → รายการแทนฟอร์ม ไม่มี POST; แก้ผ่าน API แล้วกดใหม่ได้ผลล่าสุดจนเห็นฟอร์มและสร้างได้", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const admin = await adminHeaders(request)
    const { productId, variantId } = await createUnreadyVariant(request, admin)
    const { partner } = await call(request, admin, "/admin/evoucher/partners", { name: `EV-27 partner ${uniqueTag()}` })
    const posts = countPosts(page)
    const box = page.getByTestId("evoucher-pool-prerequisites")
    const form = page.getByTestId("evoucher-pool-form")
    const save = page.getByRole("dialog").getByRole("button", { name: adminText(lng, "translation", "actions.save") })
    const paths: Record<string, string> = {
      manageInventory: `/products/${productId}/variants/${variantId}/edit`,
      inventoryItem: `/products/${productId}/variants/${variantId}/manage-items`,
      shippingProfile: `/products/${productId}/shipping-profile`,
    }

    try {
      await step("(a) ก่อนกด: ไม่มีกล่องเงื่อนไขบนหน้า และปุ่ม Create pool กดได้", async () => {
        await loginAdmin(page)
        await page.goto(variantUrl(productId, variantId))
        await expect(page.getByTestId("evoucher-pool-create")).toBeEnabled()
        await expect(box).toHaveCount(0)
      })

      await step("(a) กดปุ่ม → รายการ manageInventory, inventoryItem, shippingProfile แทนฟอร์ม ไม่มี Save", async () => {
        await openCheck(page)
        await expect(box).toBeVisible()
        await expect(box).toContainText(prereq(lng, "title"))
        for (const code of Object.keys(paths)) {
          await expect(page.getByTestId(`evoucher-pool-prereq-${code}`)).toContainText(prereq(lng, code))
          await expect(page.getByTestId(`evoucher-pool-prereq-${code}-link`)).toHaveText(prereq(lng, "fix"))
          await expect(page.getByTestId(`evoucher-pool-prereq-${code}-link`)).toHaveAttribute(
            "href",
            new RegExp(`${escapeRe(paths[code]!)}$`)
          )
        }
        await expect(page.getByTestId("evoucher-pool-prereq-stockLocation")).toHaveCount(0)
        await expect(form).toHaveCount(0)
        await expect(save).toHaveCount(0)
        await expectLanguage(lng, await box.innerText())
        await evidence("01-prerequisites-list")
      })

      await step("(a) ⌘/Ctrl+Enter ใน dialog → ไม่มี POST", async () => {
        await page.keyboard.press("ControlOrMeta+Enter")
        await expect(box).toBeVisible()
        expect(posts).toHaveLength(0)
      })

      await step("(a) คลิกลิงก์ manageInventory → modal ปิด แล้วไปหน้าแก้ variant ของ Medusa", async () => {
        await page.getByTestId("evoucher-pool-prereq-manageInventory-link").click()
        await expect(page).toHaveURL(new RegExp(`/app${escapeRe(paths.manageInventory!)}$`))
        await expect(heading(page)).toHaveCount(0)
        await expect(box).toHaveCount(0)
      })

      await step("(b) แก้ผ่าน API (manage inventory → inventory item, ไม่มี shipping profile) โดยไม่ reload แล้วกดใหม่ → เหลือ stockLocation", async () => {
        await call(request, admin, `/admin/products/${productId}/variants/${variantId}`, { manage_inventory: true })
        await call(request, admin, `/admin/products/${productId}`, { shipping_profile_id: null })
        // ปิด drawer ของ Medusa (Escape) → กลับหน้า variant ภายใน SPA
        await page.keyboard.press("Escape")
        await expect(page).toHaveURL(new RegExp(`${escapeRe(`/variants/${variantId}`)}$`))
        await openCheck(page)
        await expect(page.getByTestId("evoucher-pool-prereq-stockLocation")).toContainText(prereq(lng, "stockLocation"))
        await expect(box.locator('[data-testid^="evoucher-pool-prereq-"][data-testid$="-link"]')).toHaveCount(1)
        await expect(form).toHaveCount(0)
        expect(posts).toHaveLength(0)
      })

      await step("(b) ปิด dialog เพิ่ม location level ผ่าน API แล้วกดใหม่ → ฟอร์มเดิม; Save → POST 1 ครั้ง 200", async () => {
        const { variant } = await call(
          request,
          admin,
          `/admin/products/${productId}/variants/${variantId}?fields=inventory_items.inventory_item_id`
        )
        expect(variant.inventory_items).toHaveLength(1)
        const href = await page.getByTestId("evoucher-pool-prereq-stockLocation-link").getAttribute("href")
        expect(href).toMatch(new RegExp(`/inventory/${escapeRe(variant.inventory_items[0].inventory_item_id)}/locations$`))
        await page.keyboard.press("Escape")
        await expect(heading(page)).toHaveCount(0)
        const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
        await call(request, admin, `/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`, {
          location_id: stock_locations[0].id,
          stocked_quantity: 0,
        })
        await openCheck(page)
        await expect(form).toBeVisible()
        await expect(box).toHaveCount(0)
        const dialog = page.getByRole("dialog")
        await dialog.getByLabel(text(lng, "fields.partnerRequired"), { exact: true }).click()
        await page.getByRole("option", { name: partner.name }).click()
        await dialog.getByLabel(text(lng, "fields.nameRequired"), { exact: true }).fill("EV-27 pool")
        await dialog.getByLabel(text(lng, "fields.howToUseRequired"), { exact: true }).fill("Show the code")
        await evidence("02-form-after-fix")
        const created = page.waitForResponse(
          (res) => res.request().method() === "POST" && new URL(res.url()).pathname === POOLS_PATH
        )
        await save.click()
        expect((await created).status()).toBe(200)
        await expect(heading(page)).toHaveCount(0)
        expect(posts).toHaveLength(1)
      })
    } finally {
      const { pools } = await call(request, admin, `${POOLS_PATH}?variant_id=${variantId}`)
      const paths = [...pools.map((pool: { id: string }) => `${POOLS_PATH}/${pool.id}`), `/admin/products/${productId}`, `/admin/evoucher/partners/${partner.id}`]
      for (const path of paths) {
        const res = await request.delete(`${BACKEND_URL}${path}`, { headers: admin })
        expect.soft(res.ok(), `DELETE ${path}`).toBe(true)
      }
    }
  })

  test("(c) variant ที่มี pool แล้ว → ไม่มีกล่องเงื่อนไขและไม่มีปุ่ม Create pool", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const voucher = await createVoucher(request, admin, 0)
    const { products } = await call(request, admin, `/admin/products?handle=${voucher.handle}&fields=id`)

    await step("หน้า variant: เห็น Manage codes, ไม่มี evoucher-pool-create / evoucher-pool-prerequisites", async () => {
      await loginAdmin(page)
      await page.goto(variantUrl(products[0].id, voucher.variantId))
      await expect(page.getByRole("link", { name: text(lng, "variantWidget.manageCodes"), exact: true })).toBeVisible()
      await expect(page.getByTestId("evoucher-pool-create")).toHaveCount(0)
      await expect(page.getByTestId("evoucher-pool-prerequisites")).toHaveCount(0)
    })
  })

  test("(d) GET /admin/products/:id ล้ม → error แทนฟอร์ม ไม่มี POST; ยกเลิก mock แล้วกดใหม่ได้ผลตรวจจริง", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const { productId, variantId } = await createPoolReadyVariant(request, admin, `EV-27 ready ${uniqueTag()}`)
    const posts = countPosts(page)
    const message = "EV-27 mock product failure"
    // เฉพาะ GET ของ product นี้ — `/variants/...` ที่หน้า variant ใช้ไม่โดน
    const productPath = new RegExp(`/admin/products/${escapeRe(productId)}(\\?.*)?$`)
    const fail = async (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 500, json: { type: "unknown_error", message } })
        : route.fallback()

    try {
      await step("หน้า variant โหลดครบก่อน แล้ว mock GET product = 500 → กดปุ่ม → error แทนฟอร์ม", async () => {
        await loginAdmin(page)
        await page.goto(variantUrl(productId, variantId))
        await expect(page.getByTestId("evoucher-pool-create")).toBeEnabled()
        await page.route(productPath, fail)
        await openCheck(page)
        const error = page.getByTestId("evoucher-pool-prerequisites-error")
        await expect(error).toHaveText(prereq(lng, "loadError").replace("{{message}}", message))
        await expect(page.getByTestId("evoucher-pool-form")).toHaveCount(0)
        await expect(page.getByTestId("evoucher-pool-prerequisites")).toHaveCount(0)
        await page.keyboard.press("ControlOrMeta+Enter")
        expect(posts).toHaveLength(0)
        await evidence("03-prerequisites-error")
      })

      await step("ยกเลิก mock ปิด dialog แล้วกดใหม่ → ได้ผลตรวจจริง (variant พร้อม = ฟอร์ม)", async () => {
        await page.unroute(productPath, fail)
        await page.keyboard.press("Escape")
        await expect(heading(page)).toHaveCount(0)
        await openCheck(page)
        await expect(page.getByTestId("evoucher-pool-form")).toBeVisible()
        await expect(page.getByTestId("evoucher-pool-prerequisites-error")).toHaveCount(0)
        expect(posts).toHaveLength(0)
      })
    } finally {
      const res = await request.delete(`${BACKEND_URL}/admin/products/${productId}`, { headers: admin })
      expect.soft(res.ok(), `ลบ product ${productId}`).toBe(true)
    }
  })
}

test.describe("lng=th", () => {
  test.use({ ...ADMIN_UI_OPTIONS_TH, evidenceTarget: { feature: "evoucher", taskId: "EV-27" } })
  cases("th")
})

test.describe("lng=en", () => {
  test.use({ ...ADMIN_UI_OPTIONS })
  cases("en")
})
