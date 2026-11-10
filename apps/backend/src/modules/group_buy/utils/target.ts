export type GroupBuyTargetType = "orders" | "units" | "people"

export type GroupBuyTarget = {
  target_type: GroupBuyTargetType
  target_value: number
}

export type GroupBuyProgress = {
  progress_orders: number
  progress_units: number
  progress_people: number
}

const PROGRESS_FIELD: Record<GroupBuyTargetType, keyof GroupBuyProgress> = {
  orders: "progress_orders",
  units: "progress_units",
  people: "progress_people",
}

// spec 04 business rule 1 — ตัวนับมาจากคอลัมน์ denormalized ของกลุ่ม (ปรับภายใต้ lock ใน GB-3)
export function isTargetReached(
  { target_type, target_value }: GroupBuyTarget,
  progress: GroupBuyProgress
): boolean {
  return progress[PROGRESS_FIELD[target_type]] >= target_value
}
