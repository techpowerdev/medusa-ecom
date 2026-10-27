// CORE-6 (spec 01 AC-6): ไม่มี guest — guest กด "Add to cart" ถูกส่งไปหน้า login พร้อม variant ที่ค้างไว้
// หลังล็อกอิน/สมัครสำเร็จ server action เพิ่ม variant นั้นลง cart ให้
// CORE-14b (กฎ 26, AC-44): คง quantity ที่เลือกไว้ข้าม login ด้วย
export const PENDING_ADD_PARAM = "add_variant"
export const PENDING_QUANTITY_PARAM = "add_quantity"
// CORE-14d (กฎ 57): เพิ่มลง cart หลัง login ไม่สำเร็จ → หน้าแสดง add-variant-error และไม่พยายามเพิ่มซ้ำ
export const PENDING_ERROR_PARAM = "add_error"

export const MAX_LINE_ITEM_QUANTITY = 100

const COUNTRY_CODE_RE = /^[a-z]{2}$/

export const clampLineItemQuantity = (raw: string | null | undefined) =>
  Math.min(
    Math.max(parseInt(raw ?? "1", 10) || 1, 1),
    MAX_LINE_ITEM_QUANTITY
  )

export const loginPathForAddToCart = (
  countryCode: string,
  variantId: string,
  quantity = 1,
  { failed = false }: { failed?: boolean } = {}
) => {
  const query = new URLSearchParams({
    [PENDING_ADD_PARAM]: variantId,
    ...(quantity > 1 ? { [PENDING_QUANTITY_PARAM]: String(quantity) } : {}),
  })
  if (failed) {
    query.set(PENDING_ERROR_PARAM, "1")
  }
  return `/${countryCode}/account?${query}`
}

export const readPendingAddToCart = (
  form: Pick<FormData, "get">
): { variantId: string; countryCode: string; quantity: number } | null => {
  const variantId = form.get(PENDING_ADD_PARAM)?.toString()
  const countryCode = form.get("country_code")?.toString()
  if (!variantId || !countryCode || !COUNTRY_CODE_RE.test(countryCode)) {
    return null
  }
  return {
    variantId,
    countryCode,
    quantity: clampLineItemQuantity(form.get(PENDING_QUANTITY_PARAM)?.toString()),
  }
}

/** อ่าน variant ที่ค้างไว้จาก searchParams ของหน้า `/account` (server component) */
export const readPendingAddQuery = (
  searchParams: Record<string, string | string[] | undefined> | undefined
): { variantId: string; quantity: number; failed: boolean } | null => {
  const variantId = searchParams?.[PENDING_ADD_PARAM]
  if (typeof variantId !== "string" || !variantId) {
    return null
  }
  const quantity = searchParams?.[PENDING_QUANTITY_PARAM]
  return {
    variantId,
    quantity: clampLineItemQuantity(typeof quantity === "string" ? quantity : null),
    failed: searchParams?.[PENDING_ERROR_PARAM] !== undefined,
  }
}
