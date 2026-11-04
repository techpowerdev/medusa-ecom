import { APIRequestContext, BrowserContext, Page } from "@playwright/test"
import { Client } from "pg"

import { groupJoinActionMessage } from "../src/lib/util/group-join-error"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, cartWithItems, joinWith, poolGroup, type PoolGroupCtx } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, createCustomer, signInAs, type Customer } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// GB-7a2 (spec 04 กฎข้อ 14c, 27, 29c–f, 31; AC-28 ส่วน e2e, AC-47): join จากหน้ากลุ่มด้วย cart ใหม่หลาย line
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-7a2" } })

const H1 = { first_name: "สมชาย", last_name: "ใจดี", address_1: "1 ถนนสุขุมวิท", city: "กรุงเทพ", postal_code: "10110", phone: "0811111111" }
const H2 = { first_name: "สมชาย", last_name: "ใจดี", address_1: "99 ถนนนิมมาน", city: "เชียงใหม่", postal_code: "50200", phone: "0822222222" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store/admin API ใน e2e
const getJson = async (request: APIRequestContext, url: string, headers: Record<string, string>): Promise<any> => {
  const res = await request.get(url, { headers })
  expect(res.status(), `${url}: ${await res.text()}`).toBe(200)
  return res.json()
}
const storeHeaders = (ctx: PoolGroupCtx, c: Customer) => ({ authorization: `Bearer ${c.token}`, "x-publishable-api-key": ctx.pk })

/** SQL ตรงกับ DB ของ backend (CI ตั้ง DATABASE_URL ให้ job e2e) */
async function sql<T = Record<string, unknown>>(text: string, params: unknown[]): Promise<T[]> {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    return (await db.query(text, params)).rows as T[]
  } finally {
    await db.end()
  }
}

/** cart ทั้งหมดของลูกค้า (DB — POST /store/carts เกิดจาก Next server จึงนับฝั่ง browser ไม่ได้) */
async function cartIdsOf(email: string): Promise<string[]> {
  const rows = await sql<{ id: string }>(
    "select c.id from cart c join customer u on u.id = c.customer_id where u.email = $1 and c.deleted_at is null",
    [email]
  )
  return rows.map((r) => r.id)
}

/** ลูกค้าใหม่ที่ login ในเบราว์เซอร์ + cart ปัจจุบัน C (สินค้า Z นอกแคมเปญ qty 2) ใน cookie */
async function shopper(request: APIRequestContext, context: BrowserContext, baseURL: string, ctx: PoolGroupCtx, withAddress = true) {
  const customer = await createCustomer(request, ctx.pk)
  const addressIds = withAddress ? await addAddresses(request, ctx.pk, customer, [H1, H2]) : []
  const zVariant = (await getJson(request, `${BACKEND_URL}/store/products?handle=sweatshirt&fields=*variants`, { "x-publishable-api-key": ctx.pk }))
    .products[0].variants[0].id as string
  const cartC = await cartWithItems(request, ctx, customer, [{ variant_id: zVariant, quantity: 2 }])
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartC, url: baseURL }])
  return { customer, addressIds, cartC, zVariant }
}

/** เลือก option (ไซซ์) ภายใต้ wrapper ของหน้ากลุ่ม + จำนวน แล้วเพิ่มในรายการ */
async function addVariant(page: Page, size: string, quantity: number) {
  await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: new RegExp(`^${size}$`) }).click()
  await page.getByTestId("group-quantity").selectOption(String(quantity))
  await page.getByTestId("group-add-variant").click()
}

/** เลือกวิธีส่ง Standard (ลูกค้าต้องเลือกเอง — qa #238 D1) คืน id ของ option */
async function pickStandard(page: Page) {
  const shipping = page.getByTestId("group-shipping-option")
  await expect(shipping).toBeVisible()
  const id = (await shipping.locator("option").filter({ hasText: "Standard" }).getAttribute("value"))!
  await shipping.selectOption(id)
  return id
}

/**
 * server action ที่หน้ายิงหลังโหลดเสร็จ (header `next-action`) — prepare/join เกิดผ่าน server action เท่านั้น
 * (เริ่มนับหลัง networkidle: ปุ่มตะกร้าของ layout อ่าน cart ผ่าน server action ตอนโหลดเอง ไม่ใช่ของหน้ากลุ่ม)
 */
const recordActions = async (page: Page) => {
  await page.waitForLoadState("networkidle")
  const actions: string[] = []
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) actions.push(r.url())
  })
  return actions
}

test.describe("join จากหน้ากลุ่ม (AC-28, AC-47)", () => {
  test("A: หลาย variant + ที่อยู่ H2 + วิธีส่ง → cart ใหม่ join ครั้งเดียว, cart C ไม่ถูกแตะ, aff ลง draft order", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const ctx = await poolGroup(request, { max_units_per_person: 5 })
    const { customer, addressIds, cartC, zVariant } = await shopper(request, context, baseURL!, ctx)
    await context.addCookies([{ name: "aff", value: "T-GB7a2", url: baseURL! }])

    await page.goto(`/${CC}/g/${ctx.token}`)
    await addVariant(page, "S", 2)
    await addVariant(page, "M", 1)
    await expect(page.getByTestId("group-selection-item")).toHaveCount(2)
    await page.getByTestId("group-address-select").selectOption(addressIds[1])
    // dblclick: สร้าง cart ใหม่ครั้งเดียว (in-flight flag)
    await page.getByTestId("group-shipping-load").dblclick()
    const shipping = page.getByTestId("group-shipping-option")
    await expect(shipping).toBeVisible()
    // qa #238 D1: ไม่เลือกวิธีส่งให้ (ตัวแรกอาจเป็น Digital delivery ฿0 — spec 02 กฎ 8) → ยังกด join ไม่ได้จนกว่าลูกค้าเลือกเอง
    await expect(shipping).toHaveValue("")
    await expect(page.getByTestId("group-join-button")).toBeDisabled()
    const standard = shipping.locator("option").filter({ hasText: "Standard" })
    const optionId = (await standard.getAttribute("value"))!
    await shipping.selectOption(optionId)

    const actions = await recordActions(page)
    await page.getByTestId("group-join-button").dblclick()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders$`))
    // join ชุดเดียว: setShippingMethod + syncCartAffiliate (กฎข้อ 27) + joinGroupBuy — dblclick ไม่ยิงชุดที่สอง
    expect(actions.filter((u) => u.includes(`/g/${ctx.token}`))).toHaveLength(3)

    // cart ปัจจุบัน C ไม่เปลี่ยน (กฎข้อ 14c)
    expect((await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value).toBe(cartC)
    const { cart: c } = await getJson(request, `${BACKEND_URL}/store/carts/${cartC}?fields=*items,*promotions`, storeHeaders(ctx, customer))
    expect(c.items.map((i: { variant_id: string; quantity: number }) => [i.variant_id, i.quantity])).toEqual([[zVariant, 2]])
    expect((c.promotions ?? []).some((p: { code?: string }) => p.code?.startsWith("GB-"))).toBe(false)

    // dblclick → cart ใหม่ 1 ใบ + membership 1 รายการ (กันกดซ้ำ)
    const newCarts = (await cartIdsOf(customer.email)).filter((id) => id !== cartC)
    expect(newCarts).toHaveLength(1)
    const { customer: me } = await getJson(request, `${BACKEND_URL}/store/customers/me`, storeHeaders(ctx, customer))
    const { cart: joinedCart } = await getJson(request, `${BACKEND_URL}/store/carts/${newCarts[0]}`, storeHeaders(ctx, customer))
    expect(joinedCart.customer_id).toBe(me.id)
    const { memberships } = await getJson(request, `${BACKEND_URL}/store/customers/me/group-buy/memberships`, storeHeaders(ctx, customer))
    expect(memberships).toHaveLength(1)
    expect(memberships[0].units).toBe(3)

    const { draft_order: d } = await getJson(
      request,
      `${BACKEND_URL}/admin/draft-orders/${memberships[0].order_id}?fields=*items,*shipping_address,*shipping_methods,metadata,customer_id,total,item_total,shipping_total`,
      ctx.admin
    )
    expect(d.customer_id).toBe(me.id)
    expect(
      d.items.map((i: { variant_id: string; quantity: number }) => [i.variant_id, i.quantity]).sort()
    ).toEqual(
      [
        [ctx.variants.S, 2],
        [ctx.variants.M, 1],
      ].sort()
    )
    expect(d.shipping_address).toMatchObject({ address_1: H2.address_1, postal_code: H2.postal_code, country_code: CC, phone: H2.phone })
    expect(d.shipping_methods).toHaveLength(1)
    expect(d.shipping_methods[0].shipping_option_id).toBe(optionId)
    const { shipping_option: s } = await getJson(request, `${BACKEND_URL}/admin/shipping-options/${optionId}?fields=*prices`, ctx.admin)
    const thb = s.prices.find((p: { currency_code: string }) => p.currency_code === "thb")
    expect(Number(d.shipping_total)).toBeCloseTo(Number(thb.amount), 2)
    expect(Number(d.total)).toBeCloseTo(Number(d.item_total) + Number(d.shipping_total), 2)
    // AC-47: cookie aff ถูก sync ลง cart ใหม่ก่อน join → draft order มี token
    expect(d.metadata?.affiliate_token).toBe("T-GB7a2")
    await evidence("02-after-join-account-orders")
  })

  test("B ไม่มีที่อยู่ → join disabled + ลิงก์เพิ่มที่อยู่, ไม่มี cart ใหม่", async ({ page, context, request, baseURL }) => {
    const ctx = await poolGroup(request)
    const { customer, cartC } = await shopper(request, context, baseURL!, ctx, false)
    await page.goto(`/${CC}/g/${ctx.token}`)
    const actions = await recordActions(page)
    await addVariant(page, "S", 1)
    await expect(page.getByTestId("group-join-button")).toBeDisabled()
    await expect(page.getByTestId("group-add-address-link")).toHaveAttribute("href", new RegExp(`/${CC}/account/addresses$`))
    await expect(page.getByTestId("group-shipping-load")).toHaveCount(0)
    await page.getByTestId("group-join-button").click({ force: true })
    expect(actions).toEqual([])
    expect(await cartIdsOf(customer.email)).toEqual([cartC])
  })

  test("รายการรวมเกิน max_units_per_person → group-units-limit และไม่มี cart ใหม่", async ({ page, context, request, baseURL, evidence }) => {
    const ctx = await poolGroup(request, { max_units_per_person: 3 })
    const { customer, cartC } = await shopper(request, context, baseURL!, ctx)
    await page.goto(`/${CC}/g/${ctx.token}`)
    const actions = await recordActions(page)
    await addVariant(page, "S", 2)
    await addVariant(page, "L", 2)
    await expectThai(page, ["group-units-limit"])
    await expect(page.getByTestId("group-units-limit")).toContainText("3")
    await expect(page.getByTestId("group-join-button")).toBeDisabled()
    await expect(page.getByTestId("group-shipping-load")).toBeDisabled()
    await evidence("03-units-limit")
    // ลดจำนวนกลับเข้าเกณฑ์ → ข้อความหาย
    await page.getByTestId("group-selection-remove").last().click()
    await expect(page.getByTestId("group-units-limit")).toHaveCount(0)
    expect(actions).toEqual([])
    expect(await cartIdsOf(customer.email)).toEqual([cartC])
  })

  for (const scenario of ["GB_GROUP_FULL", "GB_UNITS_LIMIT_EXCEEDED"] as const) {
    test(`join ตอบ 409 ${scenario} → group-join-error ข้อความไทย และ C ไม่เปลี่ยน`, async ({ page, context, request, baseURL, evidence }) => {
      test.setTimeout(90_000)
      const full = scenario === "GB_GROUP_FULL"
      const ctx = await poolGroup(request, full ? { max_people_per_group: 1 } : { max_units_per_person: 3 })
      const { customer, cartC, zVariant } = await shopper(request, context, baseURL!, ctx)
      // กลุ่มเต็มด้วยคนอื่น / A มี membership 2 ชิ้นอยู่แล้ว (นับรวมทุก membership — กฎข้อ 4)
      await joinWith(request, ctx, full ? await createCustomer(request, ctx.pk) : customer, [{ variant_id: ctx.variants.S, quantity: 2 }])

      await page.goto(`/${CC}/g/${ctx.token}`)
      await addVariant(page, "M", 2)
      await page.getByTestId("group-shipping-load").click()
      await pickStandard(page)
      await page.getByTestId("group-join-button").click()
      const error = page.getByTestId("group-join-error")
      await expect(error).toHaveText(groupJoinActionMessage(scenario, { maxUnitsPerPerson: 3 }))
      await expectThai(page, ["group-join-error"])
      if (full) await evidence("04-group-full-error")
      expect((await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value).toBe(cartC)
      const { cart: c } = await getJson(request, `${BACKEND_URL}/store/carts/${cartC}?fields=*items`, storeHeaders(ctx, customer))
      expect(c.items.map((i: { variant_id: string; quantity: number }) => [i.variant_id, i.quantity])).toEqual([[zVariant, 2]])
    })
  }

  // qa #238 D2: กลุ่มหมดเวลาระหว่างอยู่บนหน้า → หน้า render ใหม่หลัง server action แล้วปุ่มหาย แต่ error ของ join ต้องยังแสดง
  test("กลุ่มหมดเวลาระหว่างอยู่บนหน้า → join ตอบ 400 และ group-join-error ยังแสดงหลังปุ่มหาย", async ({ page, context, request, baseURL }) => {
    const ctx = await poolGroup(request)
    await shopper(request, context, baseURL!, ctx)
    await page.goto(`/${CC}/g/${ctx.token}`)
    await addVariant(page, "S", 1)
    await page.getByTestId("group-shipping-load").click()
    await pickStandard(page)
    await sql("update group_buy_group set ends_at = now() - interval '1 second' where id = $1", [ctx.groupId])
    await page.getByTestId("group-join-button").click()
    await expect(page.getByTestId("group-join-error")).toHaveText(groupJoinActionMessage("closed"))
    await expect(page.getByTestId("group-join-button")).toHaveCount(0)
    await expect(page.getByTestId("group-share-link")).toHaveCount(0)
    await expectThai(page, ["group-join-error"])
  })

  test("ยังไม่ login: กด join → หน้า login ไม่มี server action (ไม่มี join/cart ใหม่) (AC-47)", async ({ page, request }) => {
    const ctx = await poolGroup(request)
    await page.goto(`/${CC}/g/${ctx.token}`)
    const actions = await recordActions(page)
    await expect(page.getByTestId("group-address-select")).toHaveCount(0)
    await page.getByTestId("group-join-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account$`))
    expect(actions).toEqual([])
    const { group } = await getJson(request, `${BACKEND_URL}/store/group-buy/groups/${ctx.token}`, { "x-publishable-api-key": ctx.pk })
    expect(group.progress_people).toBe(0)
  })
})
