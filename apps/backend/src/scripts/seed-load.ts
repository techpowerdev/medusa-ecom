import { randomBytes } from "crypto"
import { writeFileSync } from "fs"
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createCampaignsWorkflow,
  createCustomerAccountWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { testProvidersGuarded } from "../lib/prod-guards"
import { upsertFlashSaleConfigWorkflow } from "../workflows/flash-sale/upsert-flash-sale-config"
import { createGroupBuyCampaignWorkflow, type CreateGroupBuyCampaignInput } from "../workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../workflows/group-buy/create-group"
import { getPublishableKey } from "./print-publishable-key"

// OPS-4 (spec 07 AC-2, AC-3, Q-O3 b): ข้อมูลของ load test — รันหลัง seed หลักใน container ของ stack แบบ prod:
//   medusa exec ./src/scripts/seed-load.js   (env LOAD_* ดู tools/load/run.sh)
// เขียน JSON (ลูกค้า + token) ให้ k6 อ่าน — ไฟล์อยู่ใน runner เท่านั้น ไม่ commit

export type LoadCustomer = { customer_id: string; token: string }
export type LoadData = {
  publishable_key: string
  region_id: string
  shipping_option_id: string
  flash: { campaign_id: string; variant_id: string; customers: LoadCustomer[] }
  group_buy: { group_id: string; join_token: string; variant_id: string; customers: LoadCustomer[] }
}
export type SeedLoadOptions = {
  /** origin ของ backend ที่ออก token (`/auth/customer/emailpass`) */
  authUrl: string
  flashCustomers: number
  joinCustomers: number
  totalCap: number
  groupSize: number
}

const HOUR = 60 * 60 * 1000
const CONCURRENCY = 10

async function inChunks<T>(count: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = []
  for (let start = 0; start < count; start += CONCURRENCY) {
    const size = Math.min(CONCURRENCY, count - start)
    out.push(...(await Promise.all(Array.from({ length: size }, (_, k) => fn(start + k)))))
  }
  return out
}

export async function seedLoad(container: MedusaContainer, opts: SeedLoadOptions): Promise<LoadData> {
  if (testProvidersGuarded(process.env)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "seed-load สร้างลูกค้าทดสอบ — production ต้องตั้ง ALLOW_TEST_PROVIDERS=true (stack ของ load test เท่านั้น, ADR-010)"
    )
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const run = randomBytes(4).toString("hex")

  const [{ data: regions }, { data: options }, { data: stores }, { data: profiles }] = await Promise.all([
    query.graph({ entity: "region", fields: ["id"], filters: { currency_code: "thb" } }),
    query.graph({ entity: "shipping_option", fields: ["id"], filters: { type: { code: "standard" } } }),
    query.graph({ entity: "store", fields: ["default_sales_channel_id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type: "default" } }),
  ])
  if (!regions[0] || !options[0] || !stores[0]?.default_sales_channel_id || !profiles[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "ไม่พบ region/shipping option/sales channel ของ seed — รัน seed ก่อน")
  }

  // สินค้าของ load test ไม่ตัด stock (burst add-to-cart สะสมจำนวนใน cart) — flash กับ group buy คนละตัวไม่ให้ส่วนลดปนกัน
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: ["flash", "group"].map((kind) => ({
        title: `Load ${kind} ${run}`,
        handle: `load-${kind}-${run}`,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: profiles[0].id,
        options: [{ title: "Size", values: ["One"] }],
        variants: [
          {
            title: "One",
            manage_inventory: false,
            options: { Size: "One" },
            prices: [{ currency_code: "thb", amount: 500 }],
          },
        ],
        sales_channels: [{ id: stores[0].default_sales_channel_id! }],
      })),
    },
  })
  const [flashVariantId, groupVariantId] = products.map((p) => p.variants[0].id)

  const { result: campaigns } = await createCampaignsWorkflow(container).run({
    input: { campaignsData: [{ name: `Load flash ${run}`, campaign_identifier: `load-flash-${run}` }] },
  })
  await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          code: `LOADFLASH${run.toUpperCase()}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaigns[0].id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 1,
            value: 20,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [flashVariantId] }],
          },
        },
      ],
    },
  })
  await upsertFlashSaleConfigWorkflow(container).run({
    input: { campaign_id: campaigns[0].id, total_cap: opts.totalCap, per_customer_limit: null },
  })

  // target ไม่มีทางถึง → กลุ่มเปิดตลอดการทดสอบ จำนวนสมาชิกถูกจำกัดด้วย max_people_per_group เท่านั้น
  const { result: gbCampaign } = await createGroupBuyCampaignWorkflow(container).run({
    input: {
      name: `Load group ${run}`,
      target_type: "orders",
      target_value: 1_000_000,
      max_people_per_group: opts.groupSize,
      group_mode: "pool",
      starts_at: new Date(Date.now() - HOUR).toISOString(),
      ends_at: new Date(Date.now() + 24 * HOUR).toISOString(),
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 1,
        value: 10,
        target_rules: [{ attribute: "items.variant_id", operator: "in", values: [groupVariantId] }],
      },
    } as CreateGroupBuyCampaignInput,
  })
  await setGroupBuyCampaignStatusWorkflow(container).run({ input: { id: gbCampaign.id, status: "active" } })
  const { result: group } = await createGroupWorkflow(container).run({
    input: { campaign_id: gbCampaign.id, kind: "pool" },
  })

  // ลูกค้าผ่าน auth module + createCustomerAccountWorkflow (เส้นทางเดียวกับ /store/customers) แล้วล็อกอินผ่าน HTTP
  const authModule = container.resolve(Modules.AUTH)
  const password = randomBytes(16).toString("hex")
  const customer = async (label: string, i: number): Promise<LoadCustomer> => {
    const email = `load-${label}-${run}-${i}@example.com`
    const { authIdentity, error } = await authModule.register("emailpass", { body: { email, password } })
    if (!authIdentity) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `register ${email}: ${error}`)
    }
    const { result } = await createCustomerAccountWorkflow(container).run({
      input: { authIdentityId: authIdentity.id, customerData: { email } },
    })
    const res = await fetch(`${opts.authUrl}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { token?: string }
    if (!res.ok || !body.token) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `login ${email}: ${res.status}`)
    }
    return { customer_id: result.id, token: body.token }
  }

  return {
    publishable_key: await getPublishableKey(container),
    region_id: regions[0].id,
    shipping_option_id: options[0].id,
    flash: {
      campaign_id: campaigns[0].id,
      variant_id: flashVariantId,
      customers: await inChunks(opts.flashCustomers, (i) => customer("flash", i)),
    },
    group_buy: {
      group_id: group.id,
      join_token: group.join_token,
      variant_id: groupVariantId,
      customers: await inChunks(opts.joinCustomers, (i) => customer("join", i)),
    },
  }
}

export default async function seedLoadScript({ container }: ExecArgs) {
  const env = process.env
  const data = await seedLoad(container, {
    authUrl: env.LOAD_AUTH_URL || "http://localhost:9000",
    flashCustomers: Number(env.LOAD_FLASH_CUSTOMERS || 300),
    joinCustomers: Number(env.LOAD_JOIN_CUSTOMERS || 200),
    totalCap: Number(env.LOAD_FLASH_TOTAL_CAP || 100),
    groupSize: Number(env.LOAD_GROUP_SIZE || 10),
  })
  const out = env.LOAD_OUTPUT || "/tmp/load-data.json"
  writeFileSync(out, JSON.stringify(data))
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`seed-load: ${data.flash.customers.length} flash + ${data.group_buy.customers.length} join customers → ${out}`)
}
