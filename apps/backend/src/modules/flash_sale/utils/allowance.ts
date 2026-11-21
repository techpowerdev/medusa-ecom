// FS-20 (spec 03 กฎข้อ 25): สิทธิ์ flash ที่เหลือของลูกค้าต่อแคมเปญ — pure
// "ใช้ไปแล้ว" = `FlashSaleUsage.units` ของ (campaign, customer) หรือ 0 เมื่อไม่มีแถว — ตัวนับเดียวกับที่
// `reserveForCart` ตรวจด้วย SQL atomic ตอน complete (ด่านจริง); ค่านี้ใช้แสดง/เตือนก่อนจ่ายเท่านั้น

export type CustomerAllowance = {
  per_customer_limit: number | null
  used_units: number
  remaining_for_customer: number | null
}

export function customerAllowance(
  perCustomerLimit: number | null | undefined,
  usage: { units?: number | null } | null | undefined
): CustomerAllowance {
  const limit = perCustomerLimit ?? null
  const used = Number(usage?.units ?? 0)
  return {
    per_customer_limit: limit,
    used_units: used,
    remaining_for_customer: limit === null ? null : Math.max(0, limit - used),
  }
}
