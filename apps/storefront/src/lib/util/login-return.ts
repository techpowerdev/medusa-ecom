// CORE-14 (spec 01 AC-41, กฎ 25): /buy/[items] สร้าง cart ได้เฉพาะ customer ที่ล็อกอินแล้ว
// ยังไม่ล็อกอิน → หน้า login พร้อม return URL; ล็อกอินสำเร็จแล้วกลับไป /buy/... (รับเฉพาะ path ของ /buy/ กัน open redirect)
export const RETURN_TO_PARAM = "return_to"

const BUY_PATH_RE = /^\/buy\/[^/\\]+$/

export const loginPathForReturn = (countryCode: string, returnTo: string) =>
  `/${countryCode}/account?${new URLSearchParams({ [RETURN_TO_PARAM]: returnTo })}`

export const readReturnTo = (form: Pick<FormData, "get">): string | null => {
  const value = form.get(RETURN_TO_PARAM)?.toString()
  if (!value) {
    return null
  }
  const pathname = value.split("?")[0]
  return BUY_PATH_RE.test(pathname) && !pathname.includes("..") ? value : null
}
