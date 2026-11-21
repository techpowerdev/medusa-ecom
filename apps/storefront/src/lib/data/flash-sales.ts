"use server"

import { sdk } from "@lib/config"
import { CATALOG_REVALIDATE_SECONDS } from "@lib/util/catalog-cache"
import {
  type FlashAllowance,
  cartCustomerLimitExceeded,
  flashCampaignVariantIds,
} from "@lib/util/flash-allowance"
import {
  type ActiveFlashSales,
  type FlashSale,
  cartFlashExceeded,
  mergeActiveFlashSales,
} from "@lib/util/flash-sale"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"

// FS-6: endpoint ของ FS-4/FS-7 รับ variant_ids ได้ไม่เกิน 24 ตัวต่อครั้ง
const MAX_VARIANTS = 24

/**
 * แคมเปญ flash ที่กำลังทำงาน + ราคา flash ต่อ variant (`GET /store/flash-sales/active`, อ่านอย่างเดียว เปิดสาธารณะ)
 * no-store: `sold_out`/`remaining_units` เปลี่ยนตาม checkout จริง (กฎข้อ 4) ห้าม cache
 * ล้มเหลว → null (หน้าแสดงราคาปกติ ไม่ทำให้หน้าพัง)
 */
export async function getActiveFlashSales(
  regionId: string,
  variantIds: string[]
): Promise<ActiveFlashSales | null> {
  const ids = Array.from(new Set(variantIds))
  if (!ids.length) {
    return null
  }

  // FS-13: PLP มีหลายสินค้า → แบ่ง request ละไม่เกิน MAX_VARIANTS แล้วรวมผล (ยิงพร้อมกัน)
  const parts = await Promise.all(
    chunksOf(ids).map((variant_ids) =>
      sdk.client
        .fetch<ActiveFlashSales>("/store/flash-sales/active", {
          method: "GET",
          query: { region_id: regionId, variant_ids },
          cache: "no-store",
        })
        .catch(() => null)
    )
  )
  return mergeActiveFlashSales(parts)
}

const chunksOf = (ids: string[]) => {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += MAX_VARIANTS) {
    chunks.push(ids.slice(i, i + MAX_VARIANTS))
  }
  return chunks
}

/**
 * FS-21 (spec 03 กฎข้อ 25–26): สิทธิ์ flash ที่เหลือของลูกค้าที่ login (`GET /store/customers/me/flash-sales/allowance`, FS-20)
 * ส่งเฉพาะ variant ที่ FS-4 บอกว่าอยู่ในแคมเปญ (ชุดละ ≤ 24); ไม่ login → ไม่เรียก route คืน []; request ล้ม → [] (ไม่เตือน)
 */
export async function getFlashAllowances(
  regionId: string,
  variantIds: string[]
): Promise<FlashAllowance[]> {
  const ids = Array.from(new Set(variantIds))
  const headers = await getAuthHeaders()
  if (!ids.length || !("authorization" in headers)) {
    return []
  }
  const parts = await Promise.all(
    chunksOf(ids).map((variant_ids) =>
      sdk.client
        .fetch<{ allowances: FlashAllowance[] }>("/store/customers/me/flash-sales/allowance", {
          method: "GET",
          query: { region_id: regionId, variant_ids },
          headers,
          cache: "no-store",
        })
        .then((r) => r.allowances ?? [])
        .catch(() => [])
    )
  )
  return parts.flat()
}

/**
 * FS-21 (กฎข้อ 26a): ข้อมูล flash ของ PDP ใน server action เดียว — แคมเปญ/ราคา (FS-4) + สิทธิ์ต่อคนของ variant ในแคมเปญ
 * (ไม่ login → allowances = []) ให้สถานะรอของปุ่ม (FS-16) ผูกกับ request เดียวเหมือนเดิม
 */
export async function getProductFlash(
  regionId: string,
  variantIds: string[]
): Promise<{ data: ActiveFlashSales | null; allowances: FlashAllowance[] }> {
  const data = await getActiveFlashSales(regionId, variantIds)
  const allowances = await getFlashAllowances(regionId, flashCampaignVariantIds(data))
  return { data, allowances }
}

export type CartFlashChecks = {
  /** FS-15 (กฎข้อ 20b): line id → remaining_units ของ line ที่จำนวนเกินโควตาแคมเปญ */
  remaining: Record<string, number>
  /** FS-21 (กฎข้อ 26b): line id → remaining_for_customer ของ line ที่รวมกันเกินสิทธิ์ต่อคน */
  customerLimit: Record<string, number>
}

/**
 * FS-15 + FS-21: คำเตือน flash ของ cart — `GET /store/flash-sales/active` ครั้งเดียว แล้วถามสิทธิ์ต่อคนเฉพาะ variant ในแคมเปญ
 * ไม่มี line ในแคมเปญ หรือ request ล้ม → {} (ไม่เตือน)
 */
export async function getCartFlashChecks(cart: HttpTypes.StoreCart): Promise<CartFlashChecks> {
  const items = cart.items ?? []
  const variantIds = items.flatMap((i) => (i.variant_id ? [i.variant_id] : []))
  if (!cart.region_id || !variantIds.length) {
    return { remaining: {}, customerLimit: {} }
  }
  const data = await getActiveFlashSales(cart.region_id, variantIds)
  const allowances = await getFlashAllowances(cart.region_id, flashCampaignVariantIds(data))
  return {
    remaining: cartFlashExceeded(items, cart.promotions, data, Date.now()),
    customerLimit: cartCustomerLimitExceeded(items, cart.promotions, allowances),
  }
}

/**
 * GB-7c (spec 04 กฎข้อ 29a): แคมเปญ flash ที่ active ทั้งหมดสำหรับการ์ดบนหน้าแรก — เรียก route เดิมของ FS-4 โดยไม่ส่ง `variant_ids`
 * (ไม่แก้ `getActiveFlashSales` ที่คืน null เมื่อไม่มี variant) ใช้ cache ของหน้าแรก (ADR-017: `sold_out`/`remaining_units` ค้างได้ ~90 วินาที)
 * ล้มเหลว → [] (ไม่แสดงการ์ด flash)
 */
export async function listActiveFlashCampaigns(): Promise<FlashSale[]> {
  return sdk.client
    .fetch<ActiveFlashSales>("/store/flash-sales/active", {
      method: "GET",
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    })
    .then(({ flash_sales }) => flash_sales ?? [])
    .catch(() => [])
}
