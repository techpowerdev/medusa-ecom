import { MedusaError } from "@medusajs/framework/utils"

// spec 04 กฎข้อ 46 (GB-23): มีทั้งสองค่า → max_units_per_person ≤ max_quantity ของต้นแบบ; ขาดตัวใดตัวหนึ่ง → ผ่าน
export const MAX_UNITS_MESSAGE =
  "max_units_per_person must be less than or equal to application_method.max_quantity"

export const isMaxUnitsWithinMaxQuantity = (
  maxUnitsPerPerson: number | null | undefined,
  maxQuantity: number | null | undefined
): boolean => maxUnitsPerPerson == null || maxQuantity == null || maxUnitsPerPerson <= maxQuantity

export function assertMaxUnitsWithinMaxQuantity(
  maxUnitsPerPerson: number | null | undefined,
  maxQuantity: number | null | undefined
): void {
  if (!isMaxUnitsWithinMaxQuantity(maxUnitsPerPerson, maxQuantity)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, MAX_UNITS_MESSAGE)
  }
}
