import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import {
  EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
  PROMOTION_NOT_COMBINABLE,
  exclusiveAutomaticRule,
} from "../../src/lib/promotion-exclusivity"

jest.setTimeout(120 * 1000)

// PROMO-1: spec 03 กฎข้อ 6 + AC-8 (a)–(f), spec 04 กฎข้อ 7 (ADR-009)
// F = automatic + exclusivity rule (flash), N = automatic ไม่มี rule, SAVE10 / GB-TEST1 = code
// test สร้าง promotion เองผ่าน admin API ไม่พึ่ง module flash_sale / group_buy
const ADMIN_EMAIL = "promo-admin@example.com"
const ADMIN_PASSWORD = "promo-test-password"
const F_CODE = "FLASH20"
const N_CODE = "AUTO5"
const SAVE10 = "SAVE10"
const GB_CODE = "GB-TEST1"

const CART_FIELDS = "id,total,*promotions,*items,*items.adjustments"

type Cart = {
  id: string
  promotions: { code: string }[]
  items: { variant_id: string; adjustments?: { code: string }[] }[]
}

const promoCodes = (cart: Cart) => cart.promotions.map((p) => p.code).sort()
const adjustmentCodes = (cart: Cart) =>
  [...new Set(cart.items.flatMap((i) => (i.adjustments ?? []).map((a) => a.code)))].sort()

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }
    let regionId: string
    let flashVariantId: string // t-shirt S → F
    let regularVariantId: string // t-shirt M → ไม่มี automatic
    let autoVariantId: string // sweatshirt M → N
    const promotionIds: Record<string, string> = {}

    const login = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${data.token}` } }
    }

    const createPromotion = async (body: Record<string, unknown>) => {
      const { data } = await api.post("/admin/promotions", body, adminHeaders).catch((e) => {
        throw new Error(`create promotion ${body.code}: ${JSON.stringify(e.response?.data)}`)
      })
      promotionIds[data.promotion.code] = data.promotion.id
      return data.promotion
    }

    const orderPercent = (code: string, value: number) => ({
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      application_method: { type: "percentage", target_type: "order", allocation: "across", value },
    })

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container: getContainer(), args: [] })
      await login()

      const token = await getPublishableKey(getContainer())
      storeHeaders = { headers: { "x-publishable-api-key": token! } }

      const { data: regions } = await api.get("/store/regions", storeHeaders)
      regionId = regions.regions[0].id

      const { data: products } = await api.get(
        "/admin/products?fields=id,handle,*variants",
        adminHeaders
      )
      const byHandle = Object.fromEntries(products.products.map((p) => [p.handle, p]))
      const variant = (handle: string, title: string) =>
        byHandle[handle].variants.find((v) => v.title === title).id
      flashVariantId = variant("t-shirt", "S")
      regularVariantId = variant("t-shirt", "M")
      autoVariantId = variant("sweatshirt", "M")

      // F: สร้างก่อนแล้วเพิ่ม exclusivity rule ผ่าน addPromotionRulesWorkflow (แบบที่ FS-5 จะทำ)
      const flash = await createPromotion({
        code: F_CODE,
        type: "standard",
        status: "active",
        is_automatic: true,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 20,
          target_rules: [
            { attribute: "items.variant_id", operator: "in", values: [flashVariantId] },
          ],
        },
      })
      await api.post(
        `/admin/promotions/${flash.id}/rules/batch`,
        { create: [exclusiveAutomaticRule()] },
        adminHeaders
      )

      await createPromotion({
        code: N_CODE,
        type: "standard",
        status: "active",
        is_automatic: true,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 5,
          target_rules: [
            { attribute: "items.variant_id", operator: "in", values: [autoVariantId] },
          ],
        },
      })
      await createPromotion(orderPercent(SAVE10, 10))
      await createPromotion(orderPercent(GB_CODE, 15))
    })

    beforeEach(login)

    const createCart = async (variantIds: string[]): Promise<Cart> => {
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          items: variantIds.map((variant_id) => ({ variant_id, quantity: 1 })),
        },
        storeHeaders
      )
      return getCart(data.cart.id)
    }

    const getCart = async (id: string): Promise<Cart> => {
      const { data } = await api.get(`/store/carts/${id}?fields=${CART_FIELDS}`, storeHeaders)
      return data.cart
    }

    const addCodes = async (id: string, codes: string[]) =>
      api.post(`/store/carts/${id}/promotions`, { promo_codes: codes }, storeHeaders)

    const removeCodes = async (id: string, codes: string[]) =>
      api.delete(`/store/carts/${id}/promotions`, { ...storeHeaders, data: { promo_codes: codes } })

    const addItem = async (id: string, variant_id: string) =>
      api.post(`/store/carts/${id}/line-items`, { variant_id, quantity: 1 }, storeHeaders)

    const expectNotCombinable = async (request: Promise<unknown>) => {
      const error = await request.then(
        () => ({ response: undefined }),
        (e: { response?: { status: number; data: unknown } }) => e
      )
      expect(error.response?.status).toEqual(400)
      expect(error.response?.data).toMatchObject({ code: PROMOTION_NOT_COMBINABLE })
    }

    it("accepts the exclusivity rule (custom attribute, operator ne) via admin API", async () => {
      const { data } = await api.get(
        `/admin/promotions/${promotionIds[F_CODE]}?fields=id,is_automatic,*rules,*rules.values`,
        adminHeaders
      )
      expect(data.promotion.is_automatic).toBe(true)
      expect(data.promotion.rules).toEqual([
        expect.objectContaining({
          attribute: EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
          operator: "ne",
          values: [expect.objectContaining({ value: "true" })],
        }),
      ])
    })

    describe("spec 03 AC-8 (code ชนะ flash หลุด)", () => {
      it("(d) cart without a code gets F as usual", async () => {
        const cart = await createCart([flashVariantId])
        expect(promoCodes(cart)).toEqual([F_CODE])
        expect(adjustmentCodes(cart)).toEqual([F_CODE])
      })

      it("(d) adding a flash item to a code-free cart applies F", async () => {
        const cart = await createCart([regularVariantId])
        await addItem(cart.id, flashVariantId)
        const after = await getCart(cart.id)
        expect(adjustmentCodes(after)).toEqual([F_CODE])
      })

      it("(a) applying SAVE10 to a cart with F → 200, SAVE10 kept, F dropped", async () => {
        const cart = await createCart([flashVariantId])
        expect(adjustmentCodes(cart)).toEqual([F_CODE])

        const res = await addCodes(cart.id, [SAVE10])
        expect(res.status).toEqual(200)

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([SAVE10])
        expect(adjustmentCodes(after)).toEqual([SAVE10])
      })

      it("(b) adding a flash item to a cart with SAVE10 keeps SAVE10 and no F", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [SAVE10])

        const res = await addItem(cart.id, flashVariantId)
        expect(res.status).toEqual(200)

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([SAVE10])
        expect(adjustmentCodes(after)).toEqual([SAVE10])
      })

      it("(c) removing SAVE10 brings F back", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [SAVE10])
        await addItem(cart.id, flashVariantId)

        await removeCodes(cart.id, [SAVE10])

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([F_CODE])
        expect(adjustmentCodes(after)).toEqual([F_CODE])
      })

      it("(e) SAVE10 stacks with N (automatic without the rule)", async () => {
        const cart = await createCart([autoVariantId])
        expect(adjustmentCodes(cart)).toEqual([N_CODE])

        await addCodes(cart.id, [SAVE10])

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([N_CODE, SAVE10].sort())
        expect(adjustmentCodes(after)).toEqual([N_CODE, SAVE10].sort())
      })
    })

    describe("spec 04 กฎข้อ 7 (group buy)", () => {
      it("rejects GB-* on a cart that already has another code", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [SAVE10])

        await expectNotCombinable(addCodes(cart.id, [GB_CODE]))

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([SAVE10])
      })

      it("rejects another code on a cart that has GB-*", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [GB_CODE])

        await expectNotCombinable(addCodes(cart.id, [SAVE10]))

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([GB_CODE])
      })

      it("rejects GB-* and another code applied together", async () => {
        const cart = await createCart([regularVariantId])
        await expectNotCombinable(addCodes(cart.id, [GB_CODE, SAVE10]))
      })

      it("GB-* wins over F (flash dropped)", async () => {
        const cart = await createCart([flashVariantId])
        expect(adjustmentCodes(cart)).toEqual([F_CODE])

        await addCodes(cart.id, [GB_CODE])

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([GB_CODE])
        expect(adjustmentCodes(after)).toEqual([GB_CODE])
      })

      it("GB-* stacks with N; adding items to a GB cart still works", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [GB_CODE])

        const res = await addItem(cart.id, autoVariantId)
        expect(res.status).toEqual(200)

        const after = await getCart(cart.id)
        expect(promoCodes(after)).toEqual([GB_CODE, N_CODE].sort())
      })
    })

    describe("completeCartWorkflow backstop", () => {
      // ใส่ adjustment ตรงผ่าน Cart module เพื่อจำลอง cart ที่หลุดผ่าน hook มาได้
      const forceAdjustment = async (cartId: string, code: string) => {
        const cartModule = getContainer().resolve(Modules.CART)
        const [item] = await cartModule.listLineItems({ cart_id: cartId })
        await cartModule.addLineItemAdjustments(cartId, [
          { item_id: item.id, code, amount: 1, promotion_id: promotionIds[code] },
        ])
      }

      const preparePayment = async (cartId: string) => {
        const { data } = await api.post(
          "/store/payment-collections",
          { cart_id: cartId },
          storeHeaders
        )
        await api.post(
          `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          storeHeaders
        )
      }

      const complete = (cartId: string) =>
        api.post(`/store/carts/${cartId}/complete`, {}, storeHeaders)

      it("(f) F + SAVE10 on the same cart → complete fails PROMOTION_NOT_COMBINABLE", async () => {
        const cart = await createCart([flashVariantId])
        expect(adjustmentCodes(cart)).toEqual([F_CODE])
        await forceAdjustment(cart.id, SAVE10)
        expect(adjustmentCodes(await getCart(cart.id))).toEqual([F_CODE, SAVE10].sort())
        await preparePayment(cart.id)

        await expectNotCombinable(complete(cart.id))
      })

      it("GB-* + another code on the same cart → complete fails PROMOTION_NOT_COMBINABLE", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [GB_CODE])
        await forceAdjustment(cart.id, SAVE10)
        await preparePayment(cart.id)

        await expectNotCombinable(complete(cart.id))
      })

      it("refresh (add-to-cart) on a cart already holding GB-* + another code does not error", async () => {
        const cart = await createCart([regularVariantId])
        await addCodes(cart.id, [GB_CODE])
        await forceAdjustment(cart.id, SAVE10)

        const res = await addItem(cart.id, autoVariantId)
        expect(res.status).toEqual(200)
      })

      it("a valid cart (SAVE10 + N) completes into an order", async () => {
        const cart = await createCart([autoVariantId])
        await addCodes(cart.id, [SAVE10])
        await api.post(
          `/store/carts/${cart.id}`,
          {
            email: "somchai@example.com",
            shipping_address: {
              first_name: "Somchai",
              last_name: "Jaidee",
              address_1: "1 Sukhumvit",
              city: "Bangkok",
              postal_code: "10110",
              country_code: "th",
            },
          },
          storeHeaders
        )
        const { data: options } = await api.get(
          `/store/shipping-options?cart_id=${cart.id}`,
          storeHeaders
        )
        const standard = options.shipping_options.find((o) => o.name === "Standard")
        await api.post(
          `/store/carts/${cart.id}/shipping-methods`,
          { option_id: standard.id },
          storeHeaders
        )
        await preparePayment(cart.id)

        const { data } = await complete(cart.id)
        expect(data.type).toEqual("order")
      })
    })
  },
})
