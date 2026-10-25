// CORE-6 (spec 01 AC-6): ไม่มี guest — guest กด "Add to cart" ถูกส่งไปหน้า login พร้อม variant ที่ค้างไว้
// หลังล็อกอิน/สมัครสำเร็จ server action เพิ่ม variant นั้นลง cart ให้
export const PENDING_ADD_PARAM = "add_variant"

const COUNTRY_CODE_RE = /^[a-z]{2}$/

export const loginPathForAddToCart = (countryCode: string, variantId: string) =>
  `/${countryCode}/account?${new URLSearchParams({
    [PENDING_ADD_PARAM]: variantId,
  })}`

export const readPendingAddToCart = (
  form: Pick<FormData, "get">
): { variantId: string; countryCode: string } | null => {
  const variantId = form.get(PENDING_ADD_PARAM)?.toString()
  const countryCode = form.get("country_code")?.toString()
  if (!variantId || !countryCode || !COUNTRY_CODE_RE.test(countryCode)) {
    return null
  }
  return { variantId, countryCode }
}
