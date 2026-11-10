import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { createAdminUser } from "../helpers/admin"
import { shipOrderItems } from "../helpers/ship-order"

jest.setTimeout(240 * 1000)

// CORE-55 (spec 01 กฎข้อ 113, ADR-022): createAndCompleteReturnOrderWorkflow ของ Medusa 2.22.1 เติม location จาก
// return option ให้เฉพาะ fulfillment ไม่ถึงตัว return → return จากหน้าเว็บมี location_id null และ admin รับของไม่ได้ (500)
// server กำหนด location_id จาก option เอง (client ส่งไม่ได้ — CORE-16) และปฏิเสธตอนขอคืนเมื่อ item ไม่มี level ที่ location นั้น
type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: { type?: string; message?: string } } }

// กฎ CLAUDE.md: ไม่ปล่อย error ของ axios (circular) ออกจาก test
const responseOf = (request: Promise<{ status: number; data: unknown }>) =>
  request.then(
    ({ status, data }) => ({ status, data: data as { type?: string; message?: string } }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน test
const ok = async (request: Promise<{ status: number; data: any }>) => {
  try {
    return await request
  } catch (e) {
    const { response } = e as HttpError
    throw new Error(`${response?.status} ${JSON.stringify(response?.data)}`)
  }
}

const DAY = 24 * 60 * 60 * 1000

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let owner: Headers
    let admin: { headers: { authorization: string } }
    let regionId: string
    let standardOptionId: string
    let returnOptionId: string
    let returnLocationId: string
    let otherLocationId: string
    let unlinkedReturnOptionId: string
    // manage_inventory=true มี level ที่ location ของ return option, ที่ location อื่นเท่านั้น, และ manage_inventory=false
    const variants = { managed: "", elsewhere: "", unmanaged: "" }
    let managedInventoryItemId: string
    type Order = { id: string; itemId: string }

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core55-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core55-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      const a = await registerCustomer(api, pk, "core55-a@example.com", "core55-a-password")
      owner = storeHeadersFor(pk, a.token)
      admin = { headers: (await createAdminUser(container, "core55-ops@example.com")).headers }

      const { data: regions } = await query().graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: standard } = await query().graph({
        entity: "shipping_option",
        fields: ["id", "shipping_profile_id", "provider_id"],
        filters: { name: "Standard" },
      })
      standardOptionId = standard[0].id
      const { data: returnOptions } = await query().graph({
        entity: "shipping_option",
        fields: ["id", "service_zone.fulfillment_set.location.id"],
        filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
      })
      returnOptionId = returnOptions[0].id
      returnLocationId = returnOptions[0].service_zone!.fulfillment_set!.location!.id
      const { data: channels } = await query().graph({ entity: "sales_channel", fields: ["id"] })
      const link = container.resolve(ContainerRegistrationKeys.LINK)

      // stock location อื่นใน sales channel เดียวกัน (มี provider) — สินค้า "elsewhere" มี level ที่นี่เท่านั้น
      const other = await container
        .resolve(Modules.STOCK_LOCATION)
        .createStockLocations({ name: "CORE-55 other warehouse" })
      otherLocationId = other.id
      await link.create([
        { [Modules.SALES_CHANNEL]: { sales_channel_id: channels[0].id }, [Modules.STOCK_LOCATION]: { stock_location_id: other.id } },
        { [Modules.STOCK_LOCATION]: { stock_location_id: other.id }, [Modules.FULFILLMENT]: { fulfillment_provider_id: standard[0].provider_id! } },
      ])

      // AC-153: return option ที่ fulfillment set ไม่มี link กับ stock location — workflow ของ core ไม่ยอมสร้าง
      // (provider ต้องเปิดที่ location) จึงสร้างผ่าน fulfillment module ตรงเพื่อจำลองข้อมูลที่ location ถูกถอดภายหลัง
      const fulfillment = container.resolve(Modules.FULFILLMENT)
      const unlinkedSet = await fulfillment.createFulfillmentSets({
        name: "CORE-55 no location",
        type: "shipping",
        service_zones: [{ name: "CORE-55 Thailand", geo_zones: [{ type: "country", country_code: "th" }] }],
      })
      const unlinked = await fulfillment.createShippingOptions({
        name: "CORE-55 no location return",
        price_type: "flat",
        provider_id: standard[0].provider_id!,
        service_zone_id: unlinkedSet.service_zones[0].id,
        shipping_profile_id: standard[0].shipping_profile_id!,
        type: { label: "CORE-55", description: "CORE-55", code: "core-55-no-location-return" },
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "true", operator: "eq" },
        ],
      })
      unlinkedReturnOptionId = unlinked.id

      const eventBus = container.resolve(Modules.EVENT_BUS)
      const indexed = Promise.all(
        ["product.created", "product-variant.created"].map((name) =>
          TestEventUtils.waitSubscribersExecution(name, eventBus)
        )
      )
      // ราคา 1,070 รวม VAT 7% (seed) = ฿1,000 ไม่รวมภาษี
      const product = (handle: string, manage_inventory: boolean) => ({
        title: handle,
        handle,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: standard[0].shipping_profile_id!,
        options: [{ title: "Size", values: ["One"] }],
        variants: [
          {
            title: "One",
            sku: `${handle}-one`,
            manage_inventory,
            options: { Size: "One" },
            prices: [{ currency_code: "thb", amount: 1070 }],
          },
        ],
        sales_channels: [{ id: channels[0].id }],
      })
      const { result: products } = await createProductsWorkflow(container).run({
        input: {
          products: [
            product("core55-managed", true),
            product("core55-elsewhere", true),
            product("core55-unmanaged", false),
          ],
        },
      })
      await indexed
      ;[variants.managed, variants.elsewhere, variants.unmanaged] = products.map((p) => p.variants[0].id)

      const { data: items } = await query().graph({
        entity: "product_variant",
        fields: ["id", "inventory_items.inventory_item_id"],
        filters: { id: [variants.managed, variants.elsewhere] },
      })
      const inventoryOf = (variantId: string) =>
        items.find((v) => v.id === variantId)!.inventory_items![0]!.inventory_item_id
      managedInventoryItemId = inventoryOf(variants.managed)
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: managedInventoryItemId, location_id: returnLocationId, stocked_quantity: 10 },
            { inventory_item_id: inventoryOf(variants.elsewhere), location_id: otherLocationId, stocked_quantity: 10 },
          ],
        },
      })
    })

    // order ของ A (ล็อกอิน) fulfill + ship แล้ว
    const placeOrder = async (
      variantId: string,
      opts: { quantity?: number; metadata?: Record<string, unknown> } = {}
    ): Promise<Order> => {
      const quantity = opts.quantity ?? 1
      const { data } = await ok(
        api.post(
          "/store/carts",
          {
            region_id: regionId,
            metadata: opts.metadata,
            shipping_address: {
              first_name: "Somchai",
              last_name: "Jaidee",
              address_1: "1 Sukhumvit Rd",
              city: "Bangkok",
              postal_code: "10110",
              country_code: "th",
            },
            items: [{ variant_id: variantId, quantity }],
          },
          owner
        )
      )
      const cartId: string = data.cart.id
      await ok(api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, owner))
      const { data: pc } = await ok(api.post("/store/payment-collections", { cart_id: cartId }, owner))
      await ok(
        api.post(
          `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          owner
        )
      )
      const placed = TestEventUtils.waitSubscribersExecution("order.placed", getContainer().resolve(Modules.EVENT_BUS))
      const { data: completed } = await ok(api.post(`/store/carts/${cartId}/complete`, {}, owner))
      await placed
      const order = { id: completed.order.id, itemId: completed.order.items[0].id }
      if (variantId === variants.elsewhere) {
        // order ผูกกับ level ที่ location อื่น — fulfill จาก location นั้น
        const { result: fulfillment } = await createOrderFulfillmentWorkflow(getContainer()).run({
          input: { order_id: order.id, items: [{ id: order.itemId, quantity }], location_id: otherLocationId },
        })
        await createOrderShipmentWorkflow(getContainer()).run({
          input: { order_id: order.id, fulfillment_id: fulfillment.id, items: [{ id: order.itemId, quantity }] },
        })
      } else {
        await shipOrderItems(getContainer(), order.id, [{ id: order.itemId, quantity }])
      }
      return order
    }

    const requestReturn = (order: Order, optionId = returnOptionId) =>
      responseOf(
        api.post(
          "/store/returns",
          { order_id: order.id, items: [{ id: order.itemId, quantity: 1 }], return_shipping: { option_id: optionId } },
          owner
        )
      )

    const returnsOf = async (order: Order) => {
      const { data } = await query().graph({
        entity: "return",
        fields: ["id", "location_id", "status", "received_at", "items.item_id", "items.received_quantity"],
        filters: { order_id: order.id },
      })
      return data
    }

    const fulfillmentsOf = async (order: Order) => {
      const { data } = await query().graph({
        entity: "order",
        fields: ["fulfillments.id", "fulfillments.location_id"],
        filters: { id: order.id },
      })
      return data[0].fulfillments ?? []
    }

    const levelAtReturnLocation = async () => {
      const [level] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: managedInventoryItemId, location_id: returnLocationId })
      return { stocked: Number(level.stocked_quantity), reserved: Number(level.reserved_quantity) }
    }

    const totalStocked = async () => {
      const levels = await getContainer().resolve(Modules.INVENTORY).listInventoryLevels({})
      return levels.map((l) => [l.id, Number(l.stocked_quantity), Number(l.reserved_quantity)]).sort()
    }

    // ปุ่ม Receive items ของ admin: begin → receive-items → confirm
    const receive = async (returnId: string, itemId: string) => {
      const begin = await responseOf(api.post(`/admin/returns/${returnId}/receive`, {}, admin))
      const items = await responseOf(
        api.post(`/admin/returns/${returnId}/receive-items`, { items: [{ id: itemId, quantity: 1 }] }, admin)
      )
      const confirm = await responseOf(api.post(`/admin/returns/${returnId}/receive/confirm`, {}, admin))
      return [begin, items, confirm].map((r) => (r.status === 200 ? 200 : `${r.status} ${JSON.stringify(r.data)}`))
    }

    it("AC-150: a store return gets location_id from the return option (same as its fulfillment) and stays requested", async () => {
      const order = await placeOrder(variants.managed, { quantity: 2 })
      const { status, data } = await requestReturn(order)
      expect(status).toEqual(200)

      const [created] = await returnsOf(order)
      expect(created).toEqual(
        expect.objectContaining({ location_id: returnLocationId, status: "requested", received_at: null })
      )
      const { data: withFulfillments } = await query().graph({
        entity: "return",
        fields: ["fulfillments.location_id"],
        filters: { id: created.id },
      })
      expect(withFulfillments[0].fulfillments!.map((f) => f!.location_id)).toEqual([returnLocationId])
      expect((data as { return?: { id: string } }).return?.id).toEqual(created.id)
    })

    it("AC-151: admin receives 1 item → received, stock +1 at the return location, reserved unchanged, event emitted", async () => {
      const order = await placeOrder(variants.managed, { quantity: 2 })
      expect((await requestReturn(order)).status).toEqual(200)
      const [created] = await returnsOf(order)
      const before = await levelAtReturnLocation()

      const eventBus = getContainer().resolve(Modules.EVENT_BUS)
      const received: unknown[] = []
      eventBus.subscribe("order.return_received", async (event: unknown) => {
        received.push((event as { data: unknown }).data)
      })
      const done = TestEventUtils.waitSubscribersExecution("order.return_received", eventBus)
      expect(await receive(created.id, order.itemId)).toEqual([200, 200, 200])
      await done

      const [after] = await returnsOf(order)
      expect(after.status).toEqual("received")
      expect(after.items!.map((i) => [i!.item_id, Number(i!.received_quantity)])).toEqual([[order.itemId, 1]])
      expect(await levelAtReturnLocation()).toEqual({ stocked: before.stocked + 1, reserved: before.reserved })
      expect(received).toEqual([expect.objectContaining({ order_id: order.id, return_id: created.id })])
    })

    it("AC-151: receiving the full return of an attributed order appends a proportional reversed (returned) entry", async () => {
      const affiliates = getContainer().resolve<AffiliateModuleService>(AFFILIATE_MODULE)
      const ann = await affiliates.createAffiliates({
        email: "core55-ann@example.com",
        name: "Ann",
        code: "core55-ann",
        status: "active",
      })
      await affiliates.createAffiliatePrograms({
        name: "CORE-55",
        status: "published",
        starts_at: new Date(Date.now() - DAY),
        ends_at: new Date(Date.now() + DAY),
        commission_type: "percentage",
        commission_value: 10,
        scope: { all: true },
        attribution_window_days: 7,
        hold_days: 14,
      })
      const token = await affiliates.signClickToken(ann.id, new Date(Date.now() - 60 * 1000))
      // ฿1,000 × 2 × 10% = entry ฿200 → คืน 1 ใน 2 = −฿100
      const order = await placeOrder(variants.managed, { quantity: 2, metadata: { affiliate_token: token } })
      const ledger = async () =>
        (await affiliates.listAffiliateCommissionEntries({ order_id: order.id }, { order: { created_at: "ASC" } })).map(
          (e) => [e.status, Number(e.amount), e.reason]
        )
      expect(await ledger()).toEqual([["pending", 200, null]])

      expect((await requestReturn(order)).status).toEqual(200)
      const [created] = await returnsOf(order)
      const done = TestEventUtils.waitSubscribersExecution(
        "order.return_received",
        getContainer().resolve(Modules.EVENT_BUS)
      )
      expect(await receive(created.id, order.itemId)).toEqual([200, 200, 200])
      await done

      expect(await ledger()).toEqual([
        ["pending", 200, null],
        ["reversed", -100, "returned"],
      ])
    })

    it("AC-153: a return option whose fulfillment set has no stock location → 400 invalid_data and no return", async () => {
      const order = await placeOrder(variants.managed)
      const { status, data } = await requestReturn(order, unlinkedReturnOptionId)
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(await returnsOf(order)).toEqual([])
    })

    it("AC-153: a managed item without a level at the option's location → 400 'This item cannot be returned online', nothing created", async () => {
      const order = await placeOrder(variants.elsewhere)
      const fulfillments = await fulfillmentsOf(order)
      const { status, data } = await requestReturn(order)
      expect({ status, type: data?.type, message: data?.message }).toEqual({
        status: 400,
        type: "invalid_data",
        message: "This item cannot be returned online",
      })
      expect(await returnsOf(order)).toEqual([])
      expect(await fulfillmentsOf(order)).toEqual(fulfillments)
    })

    it("AC-153: an unmanaged item is returned and received at the option's location; inventory does not change", async () => {
      const order = await placeOrder(variants.unmanaged)
      const before = await totalStocked()
      expect((await requestReturn(order)).status).toEqual(200)
      const [created] = await returnsOf(order)
      expect(created.location_id).toEqual(returnLocationId)

      expect(await receive(created.id, order.itemId)).toEqual([200, 200, 200])
      expect((await returnsOf(order))[0].status).toEqual("received")
      expect(await totalStocked()).toEqual(before)
    })
  },
})
