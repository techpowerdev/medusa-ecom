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
  updateShippingOptionsWorkflow,
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
// EV-3 (ADR-006): provider `digital` (src/modules/digital_fulfillment) ลงทะเบียนด้วย id `digital`
const DIGITAL_PROVIDER_ID = "digital_digital"
const DIGITAL_OPTION_NAME = "Digital delivery"
// spec 02 กฎข้อ 8: หา option นี้ด้วย type.code เสมอ — name แก้ได้ใน admin
const DIGITAL_OPTION_TYPE_CODE = "digital-delivery"
// CORE-7 (ADR-008): th-TH = ภาษาต้นฉบับของเนื้อหาใน admin, en-US มาจาก Translation module
const STANDARD_OPTION_TYPE_CODE = "standard"
// CORE-16: return shipping option ของลูกค้า (POST /store/returns) — หาด้วย type.code เพราะ name แก้ได้ใน admin
export const RETURN_OPTION_TYPE_CODE = "standard-return"
const RETURN_OPTION_NAME = "Standard return"
export const STORE_LOCALES = ["th-TH", "en-US"]
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
  await seedStoreLocales(container)

  const { data: existing } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: REGION_NAME },
  })
  if (existing.length) {
    logger.info(`Region "${REGION_NAME}" มีอยู่แล้ว — ข้ามการ seed ข้อมูลร้าน`)
    await upgradeDigitalDelivery(container)
    await seedReturnShippingOption(container)
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
  await link.create(
    ["manual_manual", DIGITAL_PROVIDER_ID].map((fulfillment_provider_id) => ({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id },
    }))
  )
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
    amount: number,
    providerId: string
  ) => ({
    name,
    price_type: "flat" as const,
    provider_id: providerId,
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
      shippingOption(
        "Standard",
        STANDARD_OPTION_TYPE_CODE,
        defaultProfileId,
        DEFAULT_REGION_STORE_POLICIES.shipping_rate,
        "manual_manual"
      ),
      shippingOption(DIGITAL_OPTION_NAME, DIGITAL_OPTION_TYPE_CODE, digitalProfile.id, 0, DIGITAL_PROVIDER_ID),
    ],
  })
  await seedReturnShippingOption(container)

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

/**
 * EV-3: DB ที่ seed ก่อน EV-3 มี Digital delivery (หาด้วย type.code — EV-8) ผูกกับ manual_manual → เปิด provider digital ที่ stock location
 * ของ option นั้นแล้วย้าย option ไปใช้ digital_digital (คง id/ราคาเดิม) รันซ้ำได้: ถ้าย้ายแล้วจะไม่ทำอะไร
 */
async function upgradeDigitalDelivery(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "service_zone.fulfillment_set.location.id"],
    filters: { type: { code: DIGITAL_OPTION_TYPE_CODE } },
  })
  const option = options[0]
  const locationId = option?.service_zone?.fulfillment_set?.location?.id
  if (!option || !locationId || option.provider_id === DIGITAL_PROVIDER_ID) {
    return
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id"],
    filters: { id: locationId },
  })
  const enabled = (locations[0]?.fulfillment_providers ?? []).some((p) => p?.id === DIGITAL_PROVIDER_ID)
  if (!enabled) {
    await container.resolve(ContainerRegistrationKeys.LINK).create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: DIGITAL_PROVIDER_ID },
    })
  }

  await updateShippingOptionsWorkflow(container).run({
    input: [{ id: option.id, provider_id: DIGITAL_PROVIDER_ID }],
  })
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`ย้าย shipping option "${option.name}" (${DIGITAL_OPTION_TYPE_CODE}) ไปใช้ ${DIGITAL_PROVIDER_ID} แล้ว`)
}

/**
 * CORE-16: return shipping option ที่ลูกค้าใช้กับ POST /store/returns (store ระบุราคา/location/receive_now เองไม่ได้)
 * ใช้ service zone, shipping profile และ provider เดียวกับ "Standard" (หาด้วย type.code) จึงส่งคืนไปที่ stock location ของ
 * fulfillment set นั้น ราคา = 0 ถ้า free_returns ไม่เช่นนั้น = shipping_rate (DEFAULT_REGION_STORE_POLICIES)
 * รันซ้ำได้: ถ้ามี option ด้วย type.code นี้แล้วจะไม่ทำอะไร (รวม DB ที่ seed ก่อน CORE-16)
 * หมายเหตุ: ถ้า admin ลบ "Standard return" (หรือ option ที่มี type.code นี้) seed ครั้งถัดไปจะสร้างกลับ — จะเลิกใช้ให้
 * ปิดด้วย rule `enabled_in_store` หรือแก้ราคาใน admin แทนการลบ (แก้ name ได้ เพราะหาด้วย type.code)
 */
async function seedReturnShippingOption(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data: existing } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
  })
  if (existing.length) {
    return
  }

  const { data: standard } = await query.graph({
    entity: "shipping_option",
    fields: ["service_zone_id", "shipping_profile_id", "provider_id"],
    filters: { type: { code: STANDARD_OPTION_TYPE_CODE } },
  })
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: REGION_NAME },
  })
  if (!standard[0] || !regions[0]) {
    logger.warn(`ไม่พบ shipping option "${STANDARD_OPTION_TYPE_CODE}" หรือ region "${REGION_NAME}" — ข้ามการสร้าง return option`)
    return
  }

  const { free_returns, shipping_rate } = DEFAULT_REGION_STORE_POLICIES
  const amount = free_returns ? 0 : shipping_rate
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: RETURN_OPTION_NAME,
        price_type: "flat",
        provider_id: standard[0].provider_id,
        service_zone_id: standard[0].service_zone_id,
        shipping_profile_id: standard[0].shipping_profile_id,
        type: { label: RETURN_OPTION_NAME, description: RETURN_OPTION_NAME, code: RETURN_OPTION_TYPE_CODE },
        prices: [
          { currency_code: CURRENCY, amount },
          { region_id: regions[0].id, amount },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "true", operator: "eq" },
        ],
      },
    ],
  })
  logger.info(`สร้าง return shipping option "${RETURN_OPTION_NAME}" แล้ว`)
}

/**
 * ตั้ง store locales (CORE-7) แยกจากการ seed ข้อมูลร้าน จึงทำงานทั้งบน DB ใหม่และ DB ที่ seed ไปแล้ว
 * เพิ่มเฉพาะ locale ที่ยังขาด และคง locale ที่ admin เพิ่มเองไว้ (รันซ้ำไม่ซ้ำซ้อน)
 */
async function seedStoreLocales(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_locales.locale_code"],
  })
  const store = stores[0]
  const current = (store.supported_locales ?? []).map((l) => l!.locale_code)
  const missing = STORE_LOCALES.filter((code) => !current.includes(code))
  if (!missing.length) {
    return
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_locales: [...current, ...missing].map((locale_code) => ({ locale_code })),
      },
    },
  })
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`เพิ่ม store locales ${missing.join(", ")} แล้ว`)
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
