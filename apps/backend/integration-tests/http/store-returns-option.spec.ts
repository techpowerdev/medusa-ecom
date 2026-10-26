import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow, createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

// CORE-17 (owner 2026-10-26): POST /store/returns ของ Medusa 2.22.1 ไม่ตรวจ return_shipping.option_id → store ต้องใช้
// option ที่ (1) เป็น option คืนของ (rule is_return = "true") (2) เปิดใน store (rule enabled_in_store = "true")
// (3) อยู่ใน service zone ที่ครอบที่อยู่จัดส่งของ order — ไม่ผ่าน → 400 invalid_data และไม่มี return เกิดขึ้น
type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: { type?: string; message?: string } } }

const responseOf = (request: Promise<{ status: number; data: unknown }>) =>
  request.then(
    ({ status, data }) => ({ status, data: data as { type?: string; message?: string } }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let owner: Headers
    let regionId: string
    let variantId: string
    let standardOptionId: string
    let returnOptionId: string
    let disabledReturnOptionId: string
    let otherZoneReturnOptionId: string
    let otherChannelReturnOptionId: string
    type Order = { id: string; itemId: string }

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core17-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core17-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      const a = await registerCustomer(api, pk, "core17-a@example.com", "core17-a-password")
      owner = storeHeadersFor(pk, a.token)

      const { data: regions } = await query().graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query().graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      variantId = products[0].variants[0].id
      const { data: standard } = await query().graph({
        entity: "shipping_option",
        fields: ["id", "service_zone_id", "shipping_profile_id", "provider_id"],
        filters: { name: "Standard" },
      })
      standardOptionId = standard[0].id
      const { data: returnOptions } = await query().graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
      })
      returnOptionId = returnOptions[0].id

      // option คืนของที่ admin ปิดใน store (zone เดียวกับ seed) และ option คืนของของ zone อื่น (ลาว — ไม่ครอบที่อยู่ไทย)
      const fulfillment = container.resolve(Modules.FULFILLMENT)
      const otherSet = await fulfillment.createFulfillmentSets({
        name: "CORE-17 other delivery",
        type: "shipping",
        service_zones: [{ name: "CORE-17 Laos", geo_zones: [{ type: "country", country_code: "la" }] }],
      })
      const { data: locations } = await query().graph({ entity: "stock_location", fields: ["id"] })
      await container.resolve(ContainerRegistrationKeys.LINK).create({
        [Modules.STOCK_LOCATION]: { stock_location_id: locations[0].id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: otherSet.id },
      })
      const returnOption = (name: string, serviceZoneId: string, enabledInStore: string) => ({
        name,
        price_type: "flat" as const,
        provider_id: standard[0].provider_id!,
        service_zone_id: serviceZoneId,
        shipping_profile_id: standard[0].shipping_profile_id!,
        type: { label: name, description: name, code: name.toLowerCase().replace(/ /g, "-") },
        prices: [{ currency_code: "thb", amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: enabledInStore, operator: "eq" as const },
          { attribute: "is_return", value: "true", operator: "eq" as const },
        ],
      })
      // CORE-21 (AC-66): option คืนของที่ผ่านทุกข้อของ CORE-17 (zone ไทย) แต่ fulfillment set อยู่ใน stock location
      // ที่ไม่ผูกกับ sales channel ใดเลย (รวม sales channel ของ order)
      const unlinkedLocation = await container
        .resolve(Modules.STOCK_LOCATION)
        .createStockLocations({ name: "CORE-21 unlinked warehouse" })
      const unlinkedSet = await fulfillment.createFulfillmentSets({
        name: "CORE-21 unlinked delivery",
        type: "shipping",
        service_zones: [{ name: "CORE-21 Thailand", geo_zones: [{ type: "country", country_code: "th" }] }],
      })
      await container.resolve(ContainerRegistrationKeys.LINK).create([
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: unlinkedLocation.id },
          [Modules.FULFILLMENT]: { fulfillment_set_id: unlinkedSet.id },
        },
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: unlinkedLocation.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: standard[0].provider_id! },
        },
      ])
      const { result: created } = await createShippingOptionsWorkflow(container).run({
        input: [
          returnOption("CORE-17 disabled return", standard[0].service_zone_id, "false"),
          returnOption("CORE-17 other zone return", otherSet.service_zones[0].id, "true"),
          returnOption("CORE-21 other channel return", unlinkedSet.service_zones[0].id, "true"),
        ],
      })
      otherChannelReturnOptionId = created.find((o) => o.name === "CORE-21 other channel return")!.id
      disabledReturnOptionId = created.find((o) => o.name === "CORE-17 disabled return")!.id
      otherZoneReturnOptionId = created.find((o) => o.name === "CORE-17 other zone return")!.id
    })

    // แต่ละ case ใช้ order ของตัวเอง (fulfill แล้ว) — case หนึ่งล้มไม่ทำให้ case อื่นล้มตาม
    const placeOrder = async (): Promise<Order> => {
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit Rd",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: variantId, quantity: 1 }],
        },
        owner
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, owner)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, owner)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        owner
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, owner)
      const order = { id: completed.order.id, itemId: completed.order.items[0].id }
      await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: order.id, items: [{ id: order.itemId, quantity: 1 }] },
      })
      return order
    }

    const returnsOf = async (order: Order) => {
      const { data } = await query().graph({ entity: "return", fields: ["id"], filters: { order_id: order.id } })
      return data
    }

    const body = (order: Order, optionId: string) => ({
      order_id: order.id,
      items: [{ id: order.itemId, quantity: 1 }],
      return_shipping: { option_id: optionId },
    })

    it.each([
      ["an outbound option (Standard, is_return=false)", () => standardOptionId, /not a return/i],
      ["a return option disabled in store", () => disabledReturnOptionId, /not available in store/i],
      ["a return option of a service zone that does not cover the order address", () => otherZoneReturnOptionId, /shipping address/i],
      ["an option id that does not exist", () => "so_core17_missing", /not found/i],
    ])("owner using %s → 400 invalid_data and no return is created", async (_case, optionId, message) => {
      const order = await placeOrder()
      const { status, data } = await responseOf(api.post("/store/returns", body(order, optionId()), owner))
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(data?.message).toMatch(message)
      expect(await returnsOf(order)).toEqual([])
    })

    it("owner using the seeded return option (Standard return) → 200 and the return is created", async () => {
      const order = await placeOrder()
      const { status, data } = await api.post("/store/returns", body(order, returnOptionId), owner)
      expect(status).toEqual(200)
      expect((await returnsOf(order)).map((r) => r.id)).toEqual([data.return.id])
    })

    // CORE-21 AC-66: stock location ของ return option ต้องผูกกับ sales channel ของ order
    it("owner using a return option whose stock location is not in the order's sales channel → 400 invalid_data", async () => {
      const order = await placeOrder()
      const { status, data } = await responseOf(
        api.post("/store/returns", body(order, otherChannelReturnOptionId), owner)
      )
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(data?.message).toMatch(/sales channel/i)
      expect(await returnsOf(order)).toEqual([])
    })

    // CORE-21 AC-70 (AC-60c): order ที่ไม่มี country_code → Medusa ไม่กรอง geo zone จึงต้องปฏิเสธเอง (ไม่ใช่ 5xx)
    it("owner whose order has no shipping country_code → 400 invalid_data and no return is created", async () => {
      const order = await placeOrder()
      const { data: orders } = await query().graph({
        entity: "order",
        fields: ["shipping_address.id"],
        filters: { id: order.id },
      })
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrderAddresses({ id: orders[0].shipping_address!.id, country_code: null })
      const { status, data } = await responseOf(api.post("/store/returns", body(order, returnOptionId), owner))
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(data?.message).toEqual("Return shipping option does not serve the order's shipping address")
      expect(await returnsOf(order)).toEqual([])
    })

    // CORE-21 AC-71 (กฎข้อ 37): ข้อความ error คงที่ ไม่สะท้อน option_id จาก input
    it("owner using a missing option id → message does not echo the input and is the same for any id", async () => {
      const order = await placeOrder()
      const injected = "so_<script>x</script>"
      const first = await responseOf(api.post("/store/returns", body(order, injected), owner))
      const second = await responseOf(api.post("/store/returns", body(order, "so_core21_other_missing"), owner))
      expect({ status: first.status, type: first.data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(first.data?.message).not.toContain("so_<script>")
      expect(first.data?.message).not.toContain(injected)
      expect(second.data?.message).not.toContain("so_core21_other_missing")
      expect(first.data?.message).toEqual(second.data?.message)
      expect(await returnsOf(order)).toEqual([])
    })
  },
})
