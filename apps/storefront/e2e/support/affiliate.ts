import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"
import { Client } from "pg"

import { BACKEND_URL, expect } from "./fixtures"
import { Headers } from "./medusa"

/** สมัคร affiliate (actor `affiliate`) แล้วให้ admin อนุมัติเป็น active (spec 05 กฎ 7) — คืน id, code และ email/password (login portal) */
export async function createActiveAffiliate(
  request: APIRequestContext,
  admin: Headers,
  prefix = "e2e-af2"
): Promise<{ id: string; code: string; email: string; password: string }> {
  const suffix = `${Date.now().toString(36)}${crypto.randomInt(1e6)}`
  const code = `${prefix}-${suffix}`
  const email = `${code}@example.com`
  const password = crypto.randomBytes(12).toString("hex")
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email, password },
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
  return { id: affiliate.id, code, email, password }
}

/**
 * entry `approved` ของ affiliate ใส่ตรงใน DB (CI ตั้ง DATABASE_URL ให้ job e2e): การได้ entry approved ผ่าน flow จริง
 * ต้องรอ maturity job รายวัน (AF-4) ซึ่ง e2e สั่งรันไม่ได้ — payout สร้าง/จ่าย/ยกเลิกผ่าน admin API และ UI จริง
 */
export async function insertApprovedEntry(affiliateId: string, programId: string, orderId: string, createdAt: Date) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(
      `insert into affiliate_commission_entry
         (id, affiliate_id, program_id, order_id, amount, raw_amount, currency, status, created_at, updated_at)
       values ($1, $2, $3, $4, 100, '{"value":"100","precision":20}', 'thb', 'approved', $5, $5)`,
      [
        `affcom_e2e${crypto.randomBytes(6).toString("hex")}`,
        affiliateId,
        programId,
        orderId,
        createdAt,
      ],
    )
  } finally {
    await db.end()
  }
}
