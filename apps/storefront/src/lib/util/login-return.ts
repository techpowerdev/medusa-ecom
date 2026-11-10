// CORE-14 (spec 01 AC-41, กฎ 25): /buy/[items] สร้าง cart ได้เฉพาะ customer ที่ล็อกอินแล้ว
// ยังไม่ล็อกอิน → หน้า login พร้อม return URL; ล็อกอินสำเร็จแล้วกลับไป /buy/... (รับเฉพาะ path ของ /buy/ กัน open redirect)
// CORE-30 (กฎข้อ 87, AC-123): รับเพิ่มหน้ากลุ่ม `/<cc>/g/<token>` และหน้าแรก `/<cc>` — ทั้งสองแบบไม่รับ query
export const RETURN_TO_PARAM = "return_to"

const BUY_PATH_RE = /^\/buy\/[^/\\]+$/
// CORE-39 (กฎข้อ 97): token จำกัด 1..64 ตัว (join_token จริงยาว 12 ตัว — group_buy/utils/template-code.ts)
const GROUP_PAGE_RE = /^\/[a-z]{2}\/g\/[A-Za-z0-9_-]{1,64}$/
const HOME_RE = /^\/[a-z]{2}$/

export const loginPathForReturn = (countryCode: string, returnTo: string) =>
  `/${countryCode}/account?${new URLSearchParams({ [RETURN_TO_PARAM]: returnTo })}`

/** return path ของ /buy/ (สร้าง cart แล้วไป checkout) — path อื่นที่ผ่าน readReturnTo แค่ redirect กลับ */
export const isBuyReturnPath = (returnTo: string) => returnTo.startsWith("/buy/")

export const readReturnTo = (form: Pick<FormData, "get">): string | null => {
  const value = form.get(RETURN_TO_PARAM)?.toString()
  if (!value) {
    return null
  }
  if (GROUP_PAGE_RE.test(value) || HOME_RE.test(value)) {
    return value
  }
  const pathname = value.split("?")[0]
  return BUY_PATH_RE.test(pathname) && !pathname.includes("..") ? value : null
}
