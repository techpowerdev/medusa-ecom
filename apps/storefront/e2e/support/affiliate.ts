import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"
import { Client } from "pg"

import { BACKEND_URL, expect } from "./fixtures"
import { Headers } from "./medusa"

/**
 * สมัคร affiliate (actor `affiliate`) แล้วให้ admin อนุมัติเป็น active (spec 05 กฎ 7) — คืน id, code และ email/password (login portal)
 * `email` ไม่ระบุ = `<code>@example.com` (AF-18 ระบุเองเพื่อได้อีเมลยาวคงที่); `name` ไม่ระบุ = `E2E <prefix>`
 * (AF-19 ระบุเองเพื่อได้ชื่อละตินยาวคงที่); `code` ไม่ระบุ = `<prefix>-<suffix สุ่ม>` (AF-20 ระบุเองเพื่อได้รหัสยาว 32 ตัวคงที่)
 */
export async function createActiveAffiliate(
  request: APIRequestContext,
  admin: Headers,
  options: { prefix?: string; email?: string; name?: string; code?: string } = {}
): Promise<{ id: string; code: string; email: string; password: string }> {
  const {
    prefix = "e2e-af2",
    name = `E2E ${prefix}`,
    code = `${prefix}-${Date.now().toString(36)}${crypto.randomInt(1e6)}`,
    email = `${code}@example.com`,
  } = options
  const password = crypto.randomBytes(12).toString("hex")
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email, password },
  })
  expect(reg.status(), "affiliate auth register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/affiliate/register`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}` },
    data: { name, code },
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
 * คืน id ของ entry (ADM-38 ใช้หาหน้าที่แถวอยู่ด้วย `pageOffsetOf`; ผู้เรียกเดิมไม่ใช้ค่าคืน)
 */
export async function insertApprovedEntry(
  affiliateId: string,
  programId: string,
  orderId: string,
  createdAt: Date,
  amount = "100",
) {
  const id = `affcom_e2e${crypto.randomBytes(6).toString("hex")}`
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(
      `insert into affiliate_commission_entry
         (id, affiliate_id, program_id, order_id, amount, raw_amount, currency, status, created_at, updated_at)
       values ($1, $2, $3, $4, $6, $7, 'thb', 'approved', $5, $5)`,
      [
        id,
        affiliateId,
        programId,
        orderId,
        createdAt,
        amount,
        JSON.stringify({ value: amount, precision: 20 }),
      ],
    )
  } finally {
    await db.end()
  }
  return id
}

/**
 * ADM-8a (spec 08 AC-11): payout `draft` หลายแถวใส่ตรงใน DB ให้แท็บ Payouts มีมากกว่า 1 หน้า (entry_ids ว่าง — ใช้ดูรายการ/แบ่งหน้าเท่านั้น)
 * created_at ใหม่สุดก่อน (`createdAt` ของแถวแรก) คืน id ตามลำดับที่ตารางแสดง
 * ADM-37 (spec 08 AC-42a2): `reference` ใส่ให้ทุกแถว (ค่าเริ่มต้น null) — payout draft ที่มี reference ยาวยังมีปุ่ม `…` (paid ไม่มี — กฎ 10)
 * ADM-41 (spec 08 AC-46): `periodDays` = ช่วง period ย้อนหลังจาก created_at (ค่าเริ่มต้น 0 = วันเดียว — ช่วงจริงหลายวันทำให้คอลัมน์ Period กว้างขึ้น);
 * id ยาวเท่า id จริงของ Medusa (`affpay_` + ULID 26 ตัว) ให้ความกว้างคอลัมน์ Payout ตรงกับข้อมูลจริง
 */
export async function insertDraftPayouts(
  affiliateId: string,
  count: number,
  createdAt: Date,
  { reference = null, periodDays = 0 }: { reference?: string | null; periodDays?: number } = {},
) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const ids: string[] = []
  try {
    for (let i = 0; i < count; i++) {
      const id = `affpay_e2e${crypto.randomBytes(12).toString("hex").slice(0, 23)}`
      const at = new Date(createdAt.getTime() - i * 1000)
      const from = new Date(at.getTime() - periodDays * 24 * 60 * 60 * 1000)
      await db.query(
        `insert into affiliate_payout
           (id, affiliate_id, amount, raw_amount, currency, period_from, period_to, status, entry_ids, reference, created_at, updated_at)
         values ($1, $2, 1, '{"value":"1","precision":20}', 'thb', $5, $3, 'draft', '{}', $4, $3, $3)`,
        [id, affiliateId, at, reference, from],
      )
      ids.push(id)
    }
  } finally {
    await db.end()
  }
  return ids
}
