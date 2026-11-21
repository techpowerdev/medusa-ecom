import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { normalizeEmail } from "../lib/normalize-email"

// CORE-80 (spec 01 กฎข้อ 138): `identifier` คือ body ของ reset-password; field อื่นไม่แตะ
const EMAIL_FIELDS = ["email", "identifier"] as const

const normalizeFields = (body: unknown) => {
  if (!body || typeof body !== "object") return
  const record = body as Record<string, unknown>
  for (const field of EMAIL_FIELDS) {
    const value = record[field]
    if (typeof value === "string") record[field] = normalizeEmail(value)
  }
}

// แปลงทั้ง body และ validatedBody — ลำดับเทียบกับ validator ของ Medusa บน matcher เดียวกันไม่ต้องพึ่ง
export function normalizeEmailBody(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  normalizeFields(req.body)
  normalizeFields(req.validatedBody)
  next()
}

// Q-C13 = ก (owner 2026-11-21): เฉพาะ actor customer + affiliate — ไม่แตะ /auth/user/* ของแอดมิน
// affiliate อ่านอีเมลจาก auth identity (create-affiliate-account) จึงครอบด้วย /auth/affiliate/* (กฎข้อ 138 c)
const AUTH_MATCHERS = ["customer", "affiliate"].flatMap((actor) =>
  ["", "/register", "/reset-password"].map((suffix) => `/auth/${actor}/emailpass${suffix}`)
)

export const normalizeEmailMiddlewares: MiddlewareRoute[] = [
  ...AUTH_MATCHERS,
  "/store/customers",
  "/admin/customers",
  "/admin/customers/:id",
].map((matcher) => ({ method: ["POST"], matcher, middlewares: [normalizeEmailBody] }))
