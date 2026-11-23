import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL } from "./fixtures"
import { Headers, ok } from "./medusa"

// FS-25 (spec 03 กฎข้อ 30a): สินค้า/แคมเปญ flash เฉพาะของ e2e การจ่ายเงิน flash
// (fs-22-refunded-notice, pay-9-refunded-cart-repay, fs-24-card-race-refund) ผ่าน admin API

const PRICE = 1000

/** สินค้าใหม่ published 1 variant ("M", ราคา PRICE บาท) สต็อก `stock` ชิ้น — `tag` อยู่ในชื่อ/handle/sku */
export async function createFlashProduct(request: APIRequestContext, admin: Headers, tag: string, stock: number) {
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const run = `${Date.now()}`
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")
  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E ${tag} ${run}`,
        handle: `e2e-${tag.toLowerCase()}-${run}`,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          {
            title: "M",
            sku: `${tag}-${run}`,
            options: { Size: "M" },
            manage_inventory: true,
            prices: [{ currency_code: "thb", amount: PRICE }],
          },
        ],
      },
    }),
    "create product"
  )
  await ok(
    await request.post(
      `${BACKEND_URL}/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
      { headers: admin, data: { location_id: stock_locations[0].id, stocked_quantity: stock } }
    ),
    "stock level"
  )
  return { productId: product.id as string, variantId: product.variants[0].id as string }
}

/**
 * แคมเปญ flash ที่เริ่มแล้ว (จบอีก 1 ชั่วโมง) + โปรโมชันอัตโนมัติลด 20% ของ `productId` + flash config `config`
 * คืน campaign id — ผู้เรียกปิดด้วย `endFlashCampaign` เมื่อจบ; ถ้าสร้างโปรโมชัน/config ล้ม ปิดแคมเปญให้ก่อนโยน error ต่อ
 */
export async function createFlashCampaign(
  request: APIRequestContext,
  admin: Headers,
  tag: string,
  productId: string,
  config: Record<string, unknown>
): Promise<string> {
  const run = `${Date.now()}`
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns`, {
      headers: admin,
      data: {
        name: `${tag} ${run}`,
        campaign_identifier: `${tag.toLowerCase()}-${run}`,
        starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    }),
    "campaign"
  )
  try {
    await ok(
      await request.post(`${BACKEND_URL}/admin/promotions`, {
        headers: admin,
        data: {
          code: `${tag}-FLASH-${run}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "across",
            value: 20,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
          },
        },
      }),
      "promotion"
    )
    await ok(
      await request.post(`${BACKEND_URL}/admin/flash-sales/${campaign.id}/config`, { headers: admin, data: config }),
      "flash sale config"
    )
  } catch (e) {
    await endFlashCampaign(request, admin, campaign.id)
    throw e
  }
  return campaign.id as string
}

/** ปิดแคมเปญ (ends_at ย้อนไป 1 นาที) ให้ suite อื่นไม่เห็น flash ของ test นี้ */
export async function endFlashCampaign(request: APIRequestContext, admin: Headers, campaignId: string) {
  await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
      headers: admin,
      data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
    }),
    "end campaign"
  )
}
