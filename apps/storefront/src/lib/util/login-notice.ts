// CORE-95 (spec 01 กฎข้อ 151 — owner Q-C16 = ก): จ่ายบัตรแล้ว (PI succeeded/requires_capture) แต่ session หมดก่อน complete
// → หน้า login แจ้งว่าได้รับเงินแล้ว และ login สำเร็จไปหน้า orders (order มาจาก webhook ตาม ADR-015 — ข้อความไม่สัญญาว่ามี order แล้ว)
// param `notice` เป็น allow-list ค่าเดียว — ไม่ render ค่าจาก URL และปลายทางหลัง login เป็นค่าคงที่ (ไม่รับ path จาก URL)
export const LOGIN_NOTICE_PARAM = "notice"
export const PAYMENT_RECEIVED = "payment_received"
export const PAYMENT_RECEIVED_NOTICE =
  "ได้รับชำระเงินแล้ว กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ"

const COUNTRY_CODE_RE = /^[a-z]{2}$/

export const readLoginNotice = (
  value: unknown
): typeof PAYMENT_RECEIVED | null =>
  value === PAYMENT_RECEIVED ? PAYMENT_RECEIVED : null

/** หน้า login เมื่อ placeOrder ได้ `unauthorized`: `paid` = ตัดเงินแล้ว (ทางบัตร) → พร้อม notice; ยังไม่จ่าย → `/<cc>/account` เดิม */
export const unauthorizedLoginPath = (countryCode: string, paid: boolean) =>
  `/${countryCode}/account${
    paid ? `?${LOGIN_NOTICE_PARAM}=${PAYMENT_RECEIVED}` : ""
  }`

/** ปลายทางหลัง login สำเร็จของฟอร์มที่มี notice ใน allow-list; country ผิดรูป → path ไม่มี country ให้ middleware เลือก */
export const loginNoticeRedirect = (
  form: Pick<FormData, "get">
): string | null => {
  if (!readLoginNotice(form.get(LOGIN_NOTICE_PARAM))) return null
  const countryCode = form.get("country_code")?.toString() ?? ""
  return `${
    COUNTRY_CODE_RE.test(countryCode) ? `/${countryCode}` : ""
  }/account/orders`
}
