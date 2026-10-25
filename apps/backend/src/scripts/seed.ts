import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  createUserAccountWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { DEFAULT_REGION_STORE_POLICIES } from "../lib/region-store-policies"

const REGION_NAME = "Thailand"
const CURRENCY = "thb"
const COUNTRY = "th"
const VAT_RATE = 7
const STOCK_QUANTITY = 100
export const STOREFRONT_KEY_TITLE = "Storefront"

const IMG = "https://medusa-public-images.s3.eu-west-1.amazonaws.com"
const SAMPLE_PRODUCTS = [
  {
    title: "Medusa T-Shirt",
    handle: "t-shirt",
    category: "Shirts",
    image: `${IMG}/tee-black-front.png`,
    option: { title: "Size", values: ["S", "M", "L"] },
    price: 590,
  },
  {
    title: "Medusa Sweatshirt",
    handle: "sweatshirt",
    category: "Sweatshirts",
    image: `${IMG}/sweatshirt-vintage-front.png`,
    option: { title: "Size", values: ["M", "L"] },
    price: 990,
  },
]

/**
 * Seed ร้าน Thailand (CORE-2): region THB แบบราคารวม VAT 7%, shipping "Standard" + "Digital delivery",
 * stock location, publishable key ของ storefront, สินค้าตัวอย่าง และ admin user (จาก env)
 * รันซ้ำได้: ถ้ามี region Thailand แล้วจะข้ามข้อมูลร้าน และสร้าง admin เฉพาะเมื่อยังไม่มี
 */
export default async function seedThailand({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  await seedAdminUser(container)

  const { data: existing } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: REGION_NAME },
  })
  if (existing.length) {
    logger.info(`Region "${REGION_NAME}" มีอยู่แล้ว — ข้ามการ seed ข้อมูลร้าน`)
    return
  }

  const { data: stores } = await query.graph({ entity: "store", fields: ["id"] })
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: "Default Sales Channel" },
  })
  let salesChannelId = channels[0]?.id
  if (!salesChannelId) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    })
    salesChannelId = result[0].id
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: stores[0].id },
      update: {
        // is_tax_inclusive สร้าง price preference ระดับ currency → ราคาสินค้า THB รวม VAT แล้ว
        supported_currencies: [{ currency_code: CURRENCY, is_default: true, is_tax_inclusive: true }],
        default_sales_channel_id: salesChannelId,
      },
    },
  })

  const { result: regions } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: REGION_NAME,
          currency_code: CURRENCY,
          countries: [COUNTRY],
          automatic_taxes: true,
          is_tax_inclusive: true,
          // spec 06: Stripe บัตร + PromptPay (provider id `stripe` ใน medusa-config.ts)
          payment_providers: ["pp_system_default", "pp_stripe_stripe", "pp_stripe-promptpay_stripe"],
          metadata: { ...DEFAULT_REGION_STORE_POLICIES },
        },
      ],
    },
  })
  const region = regions[0]

  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: COUNTRY,
        provider_id: "tp_system",
        default_tax_rate: { name: "VAT", code: "VAT", rate: VAT_RATE },
      },
    ],
  })

  const { result: locations } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        { name: "Bangkok Warehouse", address: { city: "Bangkok", country_code: COUNTRY, address_1: "" } },
      ],
    },
  })
  const location = locations[0]
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: location.id, add: [salesChannelId] },
  })

  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const fulfillmentSet = await fulfillment.createFulfillmentSets({
    name: "Thailand delivery",
    type: "shipping",
    service_zones: [{ name: REGION_NAME, geo_zones: [{ type: "country", country_code: COUNTRY }] }],
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  const { data: defaultProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: "default" },
  })
  const { result: createdProfiles } = await createShippingProfilesWorkflow(container).run({
    input: {
      data: [
        { name: "Digital", type: "digital" },
        ...(defaultProfiles.length ? [] : [{ name: "Default", type: "default" }]),
      ],
    },
  })
  const digitalProfile = createdProfiles.find((p) => p.type === "digital")!
  const defaultProfileId =
    defaultProfiles[0]?.id ?? createdProfiles.find((p) => p.type === "default")!.id

  const shippingOption = (
    name: string,
    code: string,
    shippingProfileId: string,
    amount: number
  ) => ({
    name,
    price_type: "flat" as const,
    provider_id: "manual_manual",
    service_zone_id: fulfillmentSet.service_zones[0].id,
    shipping_profile_id: shippingProfileId,
    type: { label: name, description: name, code },
    prices: [
      { currency_code: CURRENCY, amount },
      { region_id: region.id, amount },
    ],
    rules: [
      { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
      { attribute: "is_return", value: "false", operator: "eq" as const },
    ],
  })
  await createShippingOptionsWorkflow(container).run({
    input: [
      shippingOption("Standard", "standard", defaultProfileId, DEFAULT_REGION_STORE_POLICIES.shipping_rate),
      shippingOption("Digital delivery", "digital-delivery", digitalProfile.id, 0),
    ],
  })

  const { result: apiKeys } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: STOREFRONT_KEY_TITLE, type: "publishable", created_by: "" }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: apiKeys[0].id, add: [salesChannelId] },
  })

  const { result: categories } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: SAMPLE_PRODUCTS.map((p) => ({ name: p.category, is_active: true })),
    },
  })

  await createProductsWorkflow(container).run({
    input: {
      products: SAMPLE_PRODUCTS.map((p) => ({
        title: p.title,
        handle: p.handle,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: defaultProfileId,
        category_ids: [categories.find((c) => c.name === p.category)!.id],
        images: [{ url: p.image }],
        options: [p.option],
        variants: p.option.values.map((value) => ({
          title: value,
          sku: `${p.handle}-${value}`.toUpperCase(),
          options: { [p.option.title]: value },
          prices: [{ currency_code: CURRENCY, amount: p.price }],
        })),
        sales_channels: [{ id: salesChannelId }],
      })),
    },
  })

  const { data: inventoryItems } = await query.graph({ entity: "inventory_item", fields: ["id"] })
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: location.id,
        stocked_quantity: STOCK_QUANTITY,
        inventory_item_id: item.id,
      })),
    },
  })

  logger.info(`Seed ร้าน "${REGION_NAME}" เสร็จแล้ว`)
}

/** สร้าง admin user จาก SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (ไม่มีค่า default — ห้าม hard-code secret) */
async function seedAdminUser(container: ExecArgs["container"]) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password) {
    logger.warn("ไม่ได้ตั้ง SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD — ข้ามการสร้าง admin user")
    return
  }

  const { data: users } = await query.graph({ entity: "user", fields: ["id"], filters: { email } })
  if (users.length) {
    return
  }

  const auth = container.resolve(Modules.AUTH)
  const { authIdentity, error } = await auth.register("emailpass", { body: { email, password } })
  if (error || !authIdentity) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `สร้าง auth identity ของ admin ไม่สำเร็จ: ${error}`)
  }
  await createUserAccountWorkflow(container).run({
    input: { authIdentityId: authIdentity.id, userData: { email } },
  })
  logger.info(`สร้าง admin user ${email} แล้ว`)
}
