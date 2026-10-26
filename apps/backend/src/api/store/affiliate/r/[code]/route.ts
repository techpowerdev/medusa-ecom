import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { safeRedirectPath } from "../../../../../lib/affiliate-redirect"
import { trackClickWorkflow } from "../../../../../workflows/affiliate/track-click"

const AFFILIATE_COOKIE = "aff"
// สูงสุด 30 วัน; attribution window ของโปรแกรมเป็นตัวตัดสินจริงตอน order.placed (AF-3)
const AFFILIATE_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

// spec 05 API: `GET /store/affiliate/r/:code?to=/path` (public — ไม่สร้าง/แก้ข้อมูล) → ตั้ง cookie แล้ว 302
// storefront `/r/<code>` เรียก route นี้จาก server side แล้วคัดลอก cookie `aff` ไปที่โดเมนของ storefront
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const to = safeRedirectPath(req.query.to)
  const { result } = await trackClickWorkflow(req.scope).run({
    input: { code: req.params.code },
  })

  if (result.token) {
    res.cookie(AFFILIATE_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AFFILIATE_COOKIE_MAX_AGE_MS,
      path: "/",
    })
  }

  res.redirect(302, to)
}
