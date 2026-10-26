import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

// CORE-12b (spec 01 กฎ 28, ADR-013, AC-51..AC-53): products/product-variants ที่ส่ง cart_id ใน query
// ต้องเป็น cart ของ customer ที่ล็อกอิน — ไม่ใช่เจ้าของ/ไม่พบ/ค่าไม่ถูกต้อง → 404, ไม่มี token → 401;
// ไม่มี cart_id → การเรียกดูสาธารณะเหมือนเดิม
type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: unknown } }
type Result = { status?: number; data?: any }

const call = (request: Promise<{ status: number; data: any }>): Promise<Result> =>
  request.then(
    ({ status, data }) => ({ status, data }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let regionId: string
    let productId: string
    let variantId: string
    let cartOfA: string
    let a: Headers
    let b: Headers
    let guest: Headers

    // 4 route ของ AC-51 พร้อม query ที่กำหนด; fields ขอ calculated_price ของ variant
    const routes = (qs: string): Record<string, string> => ({
      products: `/store/products?${qs}&fields=id,*variants.calculated_price`,
      product: `/store/products/${productId}?${qs}&fields=id,*variants.calculated_price`,
      variants: `/store/product-variants?${qs}&fields=id,*calculated_price`,
      variant: `/store/product-variants/${variantId}?${qs}&fields=id,*calculated_price`,
    })

    // calculated_amount ของ variant เป้าหมายจาก response ของแต่ละ route
    const priceOf = (name: string, data: any): unknown => {
      const variant =
        name === "products"
          ? data.products.find((p: any) => p.id === productId).variants.find((v: any) => v.id === variantId)
          : name === "product"
            ? data.product.variants.find((v: any) => v.id === variantId)
            : name === "variants"
              ? data.variants.find((v: any) => v.id === variantId)
              : data.variant
      return variant.calculated_price?.calculated_amount
    }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core12b-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core12b-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      guest = storeHeadersFor(pk)

      const ca = await registerCustomer(api, pk, "core12b-a@example.com", "core12b-a-password")
      const cb = await registerCustomer(api, pk, "core12b-b@example.com", "core12b-b-password")
      a = storeHeadersFor(pk, ca.token)
      b = storeHeadersFor(pk, cb.token)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { handle: "t-shirt" },
      })
      productId = products[0].id
      variantId = products[0].variants[0].id

      const { data } = await api.post("/store/carts", { region_id: regionId }, a)
      cartOfA = data.cart.id
    })

    describe("AC-51: cart_id ของคนอื่น", () => {
      it("customer B gets 404 on all 4 routes with A's cart_id", async () => {
        for (const [name, url] of Object.entries(routes(`cart_id=${cartOfA}`))) {
          const res = await call(api.get(url, b))
          expect({ name, status: res.status }).toEqual({ name, status: 404 })
        }
      })

      it("customer A gets 200 and the same calculated_price as pricing by the cart's region", async () => {
        const withCart = routes(`cart_id=${cartOfA}`)
        const withRegion = routes(`region_id=${regionId}`)
        for (const name of Object.keys(withCart)) {
          const res = await call(api.get(withCart[name], a))
          expect({ name, status: res.status }).toEqual({ name, status: 200 })
          const byRegion = await api.get(withRegion[name], guest)
          const price = priceOf(name, res.data)
          expect(price).toBeDefined()
          expect({ name, price }).toEqual({ name, price: priceOf(name, byRegion.data) })
        }
      })
    })

    describe("AC-52: ไม่มี token", () => {
      it("gets 401 with cart_id and 200 without cart_id (public browsing unchanged)", async () => {
        for (const [name, url] of Object.entries(routes(`cart_id=${cartOfA}`))) {
          const res = await call(api.get(url, guest))
          expect({ name, status: res.status }).toEqual({ name, status: 401 })
        }
        for (const [name, url] of Object.entries(routes(`region_id=${regionId}`))) {
          const res = await call(api.get(url, guest))
          expect({ name, status: res.status }).toEqual({ name, status: 200 })
        }
      })
    })

    describe("AC-53: cart_id ที่ไม่ถูกต้อง", () => {
      it.each([
        ["empty", "cart_id="],
        ["missing cart", "cart_id=cart_doesnotexist"],
        ["array", "cart_id=CA&cart_id=CA"],
      ])("customer A with %s cart_id gets 404/400, never 200 or 5xx", async (_case, qs) => {
        const query = qs.replace(/CA/g, cartOfA)
        for (const [name, url] of Object.entries(routes(query))) {
          const res = await call(api.get(url, a))
          expect({ name, ok: [400, 404].includes(res.status!) }).toEqual({ name, ok: true })
        }
      })
    })
  },
})
