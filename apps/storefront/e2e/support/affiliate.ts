import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"

import { BACKEND_URL, expect } from "./fixtures"
import { Headers } from "./medusa"

/** สมัคร affiliate (actor `affiliate`) แล้วให้ admin อนุมัติเป็น active (spec 05 กฎ 7) — คืน code และ id */
export async function createActiveAffiliate(
  request: APIRequestContext,
  admin: Headers,
  prefix = "e2e-af2"
): Promise<{ id: string; code: string }> {
  const suffix = `${Date.now().toString(36)}${crypto.randomInt(1e6)}`
  const code = `${prefix}-${suffix}`
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email: `${code}@example.com`, password: crypto.randomBytes(12).toString("hex") },
  })
  expect(reg.status(), "affiliate auth register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/affiliate/register`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}` },
    data: { name: `E2E ${prefix}`, code },
  })
  expect(created.status(), "affiliate register").toBe(200)
  const { affiliate } = await created.json()
  const approved = await request.post(`${BACKEND_URL}/admin/affiliate/affiliates/${affiliate.id}`, {
    headers: admin,
    data: { status: "active" },
  })
  expect(approved.status(), "admin approve affiliate").toBe(200)
  return { id: affiliate.id, code }
}
