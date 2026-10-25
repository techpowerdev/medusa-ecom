import { MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"

// CORE-12 (spec 01 กฎ 22-23, ADR-013): cart / payment collection / order บน store route ต้องเป็นของ
// customer ที่ล็อกอิน ไม่ตรง, ไม่พบ หรือ owner เป็น null → 404 ข้อความเดียวกันทุกกรณี (ไม่บอกว่ามีอยู่จริง)
export const STORE_RESOURCE_NOT_FOUND = "Not found"

type OwnerId = string | null

const firstRow = async (
  query: RemoteQueryFunction,
  entity: string,
  fields: string[],
  id: unknown
): Promise<Record<string, any> | null> => {
  if (typeof id !== "string" || !id) {
    return null
  }
  const { data } = await query.graph({ entity, fields, filters: { id } })
  return (data[0] as Record<string, any> | undefined) ?? null
}

export async function cartOwner(query: RemoteQueryFunction, cartId: unknown): Promise<OwnerId> {
  return (await firstRow(query, "cart", ["customer_id"], cartId))?.customer_id ?? null
}

export async function orderOwner(query: RemoteQueryFunction, orderId: unknown): Promise<OwnerId> {
  return (await firstRow(query, "order", ["customer_id"], orderId))?.customer_id ?? null
}

// payment collection ผูกกับ cart (ก่อน complete) และ order (หลัง complete) ผ่าน link ของ Medusa
export async function paymentCollectionOwner(query: RemoteQueryFunction, collectionId: unknown): Promise<OwnerId> {
  const row = await firstRow(query, "payment_collection", ["cart.customer_id", "order.customer_id"], collectionId)
  return row?.cart?.customer_id ?? row?.order?.customer_id ?? null
}

export function assertOwner(ownerId: OwnerId, actorId: string | null | undefined): void {
  if (!ownerId || !actorId || ownerId !== actorId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, STORE_RESOURCE_NOT_FOUND)
  }
}

// ADR-013 ข้อ 3: route/workflow ของเราเองที่รับ cart_id (เช่น GB-3 join) ตรวจ owner แบบเดียวกัน
export async function assertCartOwner(
  query: RemoteQueryFunction,
  cartId: unknown,
  customerId: string | null | undefined
): Promise<void> {
  assertOwner(await cartOwner(query, cartId), customerId)
}
