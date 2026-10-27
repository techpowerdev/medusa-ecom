import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  batchLinkProductsToCollectionWorkflow,
  createApiKeysWorkflow,
  createCollectionsWorkflow,
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
import { seedPaymentProviders } from "../lib/prod-guards"

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
// CORE-10 (spec 01 กฎข้อ 16, AC-68): ชื่อสินค้าและชื่อ option ภาษาไทย handle คงเดิม (URL/e2e ไม่เปลี่ยน)
const SAMPLE_PRODUCTS = [
  {
    title: "เสื้อยืด Medusa",
    handle: "t-shirt",
    category: "Shirts",
    image: `${IMG}/tee-black-front.png`,
    option: { title: "ขนาด", values: ["S", "M", "L"] },
    price: 590,
  },
  {
    title: "เสื้อสเวตเตอร์ Medusa",
    handle: "sweatshirt",
    category: "Sweatshirts",
    image: `${IMG}/sweatshirt-vintage-front.png`,
    option: { title: "ขนาด", values: ["M", "L"] },
    price: 990,
  },
]
const SAMPLE_SKUS = SAMPLE_PRODUCTS.flatMap((p) => p.option.values.map((value) => sku(p.handle, value)))
// CORE-10b (spec 01 กฎข้อ 70): collection ตัวอย่างให้หน้าแรกมี rail — หาด้วย handle (ชื่อแก้ได้ใน admin)
const FEATURED_COLLECTION = { title: "สินค้าแนะนำ", handle: "featured" }
const STOCK_LOCATION_NAME = "Bangkok Warehouse"
const FULFILLMENT_SET_NAME = "Thailand delivery"

function sku(handle: string, value: string) {
  return `${handle}-${value}`.toUpperCase()
}

type Container = ExecArgs["container"]

/**
 * Seed ร้าน Thailand (CORE-2): region THB แบบราคารวม VAT 7%, shipping "Standard" + "Digital delivery",
 * stock location, publishable key ของ storefront, สินค้าตัวอย่าง และ admin user (จาก env)
 * รันซ้ำได้ (CORE-10, spec 01 กฎข้อ 17): เช็กการมีอยู่ทีละ resource แล้วสร้างเฉพาะที่ขาด — ไม่แก้ resource ที่มีอยู่แล้ว
 */
export default async function seedThailand({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  await seedAdminUser(container)
  await seedStoreLocales(container)

  const salesChannelId = await ensureSalesChannel(container)
  await ensureStoreCurrency(container, salesChannelId)
  const regionId = await ensureRegion(container)
  await ensureTaxRegion(container)
  const locationId = await ensureStockLocation(container, salesChannelId)
  const serviceZoneId = await ensureFulfillmentSet(container, locationId)
  const defaultProfileId = await ensureShippingProfile(container, "default", "Default")
  const digitalProfileId = await ensureShippingProfile(container, "digital", "Digital")
  await ensureShippingOptions(container, { regionId, serviceZoneId, defaultProfileId, digitalProfileId })
  await upgradeDigitalDelivery(container)
  await seedReturnShippingOption(container)
  await ensurePublishableKey(container, salesChannelId)
  const categoryIds = await ensureCategories(container)
  await ensureProducts(container, { salesChannelId, defaultProfileId, categoryIds })
  await ensureInventoryLevels(container, locationId)
  await ensureFeaturedCollection(container)

  logger.info(`Seed ร้าน "${REGION_NAME}" เสร็จแล้ว`)
}

async function ensureSalesChannel(container: Container): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: "Default Sales Channel" },
  })
  if (data[0]) {
    return data[0].id
  }
  const { result } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
  })
  return result[0].id
}

/** ตั้ง THB (รวม VAT) เป็นสกุลเงินหลักเฉพาะเมื่อ store ยังไม่มี THB — ไม่ทับค่าที่ admin ตั้งไว้ */
async function ensureStoreCurrency(container: Container, salesChannelId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })
  const store = stores[0]
  if ((store.supported_currencies ?? []).some((c) => c?.currency_code === CURRENCY)) {
    return
  }
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        // is_tax_inclusive สร้าง price preference ระดับ currency → ราคาสินค้า THB รวม VAT แล้ว
        supported_currencies: [{ currency_code: CURRENCY, is_default: true, is_tax_inclusive: true }],
        default_sales_channel_id: salesChannelId,
      },
    },
  })
}

async function ensureRegion(container: Container): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "region", fields: ["id"], filters: { name: REGION_NAME } })
  if (data[0]) {
    return data[0].id
  }
  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: REGION_NAME,
          currency_code: CURRENCY,
          countries: [COUNTRY],
          automatic_taxes: true,
          is_tax_inclusive: true,
          // spec 06: Stripe บัตร + PromptPay (provider id `stripe` ใน medusa-config.ts)
          // OPS-7 (ADR-010 D1): pp_system_default เฉพาะนอก production หรือ ALLOW_TEST_PROVIDERS=true
          payment_providers: seedPaymentProviders(process.env),
          metadata: { ...DEFAULT_REGION_STORE_POLICIES },
        },
      ],
    },
  })
  return result[0].id
}

async function ensureTaxRegion(container: Container) {
  const existing = await container.resolve(Modules.TAX).listTaxRegions({ country_code: COUNTRY })
  if (existing.some((r) => !r.province_code)) {
    return
  }
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: COUNTRY,
        provider_id: "tp_system",
        default_tax_rate: { name: "VAT", code: "VAT", rate: VAT_RATE },
      },
    ],
  })
}

/** stock location + link ที่ต้องมี (fulfillment provider manual/digital, sales channel) — เพิ่มเฉพาะที่ขาด */
async function ensureStockLocation(container: Container, salesChannelId: string): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id", "sales_channels.id"],
    filters: { name: STOCK_LOCATION_NAME },
  })
  let locationId = data[0]?.id
  if (!locationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [{ name: STOCK_LOCATION_NAME, address: { city: "Bangkok", country_code: COUNTRY, address_1: "" } }],
      },
    })
    locationId = result[0].id
  }

  const providers = (data[0]?.fulfillment_providers ?? []).map((p) => p?.id)
  const missingProviders = ["manual_manual", DIGITAL_PROVIDER_ID].filter((id) => !providers.includes(id))
  if (missingProviders.length) {
    await container.resolve(ContainerRegistrationKeys.LINK).create(
      missingProviders.map((fulfillment_provider_id) => ({
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id },
      }))
    )
  }
  if (!(data[0]?.sales_channels ?? []).some((c) => c?.id === salesChannelId)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: locationId, add: [salesChannelId] },
    })
  }
  return locationId
}

/** fulfillment set ตามชื่อ (ผูกกับ stock location) คืน id ของ service zone แรก */
async function ensureFulfillmentSet(container: Container, locationId: string): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "service_zones.id", "location.id"],
    filters: { name: FULFILLMENT_SET_NAME },
  })
  const set =
    data[0] ??
    (await container.resolve(Modules.FULFILLMENT).createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [{ name: REGION_NAME, geo_zones: [{ type: "country", country_code: COUNTRY }] }],
    }))
  if (!data[0]?.location) {
    await container.resolve(ContainerRegistrationKeys.LINK).create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }
  return set.service_zones[0]!.id
}

async function ensureShippingProfile(container: Container, type: string, name: string): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type } })
  if (data[0]) {
    return data[0].id
  }
  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name, type }] },
  })
  return result[0].id
}

/** "Standard" และ "Digital delivery" หาด้วย type.code (name แก้ได้ใน admin) สร้างเฉพาะตัวที่ขาด */
async function ensureShippingOptions(
  container: Container,
  ids: { regionId: string; serviceZoneId: string; defaultProfileId: string; digitalProfileId: string }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["type.code"],
    filters: { type: { code: [STANDARD_OPTION_TYPE_CODE, DIGITAL_OPTION_TYPE_CODE] } },
  })
  const existing = data.map((o) => o.type?.code)

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
    service_zone_id: ids.serviceZoneId,
    shipping_profile_id: shippingProfileId,
    type: { label: name, description: name, code },
    prices: [
      { currency_code: CURRENCY, amount },
      { region_id: ids.regionId, amount },
    ],
    rules: [
      { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
      { attribute: "is_return", value: "false", operator: "eq" as const },
    ],
  })
  const missing = [
    // กฎข้อ 19: Standard คง shipping_rate เดิม (placeholder จนกว่า owner ตัดสิน Q-F1)
    shippingOption(
      "Standard",
      STANDARD_OPTION_TYPE_CODE,
      ids.defaultProfileId,
      DEFAULT_REGION_STORE_POLICIES.shipping_rate,
      "manual_manual"
    ),
    shippingOption(DIGITAL_OPTION_NAME, DIGITAL_OPTION_TYPE_CODE, ids.digitalProfileId, 0, DIGITAL_PROVIDER_ID),
  ].filter((option) => !existing.includes(option.type.code))
  if (missing.length) {
    await createShippingOptionsWorkflow(container).run({ input: missing })
  }
}

/** publishable key ตาม title (ไม่นับ key ที่ถูก revoke) */
async function ensurePublishableKey(container: Container, salesChannelId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "revoked_at"],
    filters: { type: "publishable", title: STOREFRONT_KEY_TITLE },
  })
  if (data.some((k) => !k.revoked_at)) {
    return
  }
  const { result } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: STOREFRONT_KEY_TITLE, type: "publishable", created_by: "" }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: result[0].id, add: [salesChannelId] },
  })
}

/** category ตามชื่อ คืน map ชื่อ → id */
async function ensureCategories(container: Container): Promise<Record<string, string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const names = [...new Set(SAMPLE_PRODUCTS.map((p) => p.category))]
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "name"], filters: { name: names } })
  const ids: Record<string, string> = Object.fromEntries(data.map((c) => [c.name, c.id]))
  const missing = names.filter((name) => !ids[name])
  if (missing.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missing.map((name) => ({ name, is_active: true })) },
    })
    result.forEach((c) => (ids[c.name] = c.id))
  }
  return ids
}

/** สินค้าตัวอย่างตาม handle */
async function ensureProducts(
  container: Container,
  ids: { salesChannelId: string; defaultProfileId: string; categoryIds: Record<string, string> }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["handle"],
    filters: { handle: SAMPLE_PRODUCTS.map((p) => p.handle) },
  })
  const existing = data.map((p) => p.handle)
  const missing = SAMPLE_PRODUCTS.filter((p) => !existing.includes(p.handle))
  if (!missing.length) {
    return
  }
  await createProductsWorkflow(container).run({
    input: {
      products: missing.map((p) => ({
        title: p.title,
        handle: p.handle,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: ids.defaultProfileId,
        category_ids: [ids.categoryIds[p.category]],
        images: [{ url: p.image }],
        options: [p.option],
        variants: p.option.values.map((value) => ({
          title: value,
          sku: sku(p.handle, value),
          options: { [p.option.title]: value },
          prices: [{ currency_code: CURRENCY, amount: p.price }],
        })),
        sales_channels: [{ id: ids.salesChannelId }],
      })),
    },
  })
}

/**
 * collection `featured` (CORE-10b) ใส่สินค้าตัวอย่างที่ยังไม่อยู่ใน collection ใด — สร้างเฉพาะเมื่อยังไม่มี handle นี้
 * มีอยู่แล้ว → ไม่สร้าง/ไม่แก้ (คงชื่อและสินค้าที่ admin จัดไว้)
 */
async function ensureFeaturedCollection(container: Container) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existing } = await query.graph({
    entity: "product_collection",
    fields: ["id"],
    filters: { handle: FEATURED_COLLECTION.handle },
  })
  if (existing.length) {
    return
  }
  const { result } = await createCollectionsWorkflow(container).run({
    input: { collections: [FEATURED_COLLECTION] },
  })
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "collection_id"],
    filters: { handle: SAMPLE_PRODUCTS.map((p) => p.handle) },
  })
  const add = products.filter((p) => !p.collection_id).map((p) => p.id)
  if (add.length) {
    await batchLinkProductsToCollectionWorkflow(container).run({ input: { id: result[0].id, add } })
  }
}

/** inventory level ของ variant ตัวอย่าง (หาด้วย SKU) ที่ stock location — สร้างเฉพาะ item ที่ยังไม่มี level ที่ location นี้ */
async function ensureInventoryLevels(container: Container, locationId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.location_id"],
    filters: { sku: SAMPLE_SKUS },
  })
  const missing = items.filter(
    (item) => !(item.location_levels ?? []).some((level) => level?.location_id === locationId)
  )
  if (!missing.length) {
    return
  }
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: missing.map((item) => ({
        location_id: locationId,
        stocked_quantity: STOCK_QUANTITY,
        inventory_item_id: item.id,
      })),
    },
  })
}

/**
 * EV-3: DB ที่ seed ก่อน EV-3 มี Digital delivery (หาด้วย type.code — EV-8) ผูกกับ manual_manual → เปิด provider digital ที่ stock location
 * ของ option นั้นแล้วย้าย option ไปใช้ digital_digital (คง id/ราคาเดิม) รันซ้ำได้: ถ้าย้ายแล้วจะไม่ทำอะไร
 */
async function upgradeDigitalDelivery(container: Container) {
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
async function seedReturnShippingOption(container: Container) {
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
