import { APIRequestContext, expect, test } from "@playwright/test"

import { deleteAllThenExpectOk } from "./cleanup"

// FS-18 (กฎข้อ 23b): request ลบที่ล้มต้องไม่ทำให้รายการถัดไปไม่ถูกลบ — ลบครบก่อนแล้วจึง assert ok() ทุกตัว
const fakeRequest = (status: Record<string, number>, calls: string[]) =>
  {
    const call = (method: string) => async (url: string) => {
      calls.push(`${method} ${new URL(url).pathname}`)
      const s = Object.entries(status).find(([p]) => url.endsWith(p))?.[1] ?? 200
      if (s === 0) throw new Error("socket hang up")
      return { ok: () => s < 300, status: () => s, text: async () => `body ${s}` }
    }
    return { delete: call("DELETE"), post: call("POST") } as unknown as APIRequestContext
  }

test("ลบครบทุก path แม้ตัวแรกตอบ 500 หรือ throw แล้วจึงล้มพร้อมรายการที่ไม่ ok", async () => {
  const calls: string[] = []
  const paths = [
    "POST /admin/orders/o/cancel",
    "/admin/promotions/p",
    "/admin/campaigns/c",
    "/admin/products/x",
    "/admin/collections/k",
  ]
  let error: Error | undefined
  try {
    await deleteAllThenExpectOk(fakeRequest({ "/promotions/p": 500, "/products/x": 0 }, calls), {}, paths)
  } catch (e) {
    error = e as Error
  }
  expect(calls).toEqual(paths.map((p) => (p.startsWith("POST ") ? p : `DELETE ${p}`)))
  expect(error?.message).toContain("DELETE /admin/promotions/p: 500")
  expect(error?.message).toContain("DELETE /admin/products/x: socket hang up")
  expect(error?.message).not.toContain("/admin/campaigns/c")
})

test("ข้าม id ที่ยังไม่ถูกสร้าง (beforeAll ล้มกลางทาง) และผ่านเมื่อทุกตัว ok", async () => {
  const calls: string[] = []
  await deleteAllThenExpectOk(fakeRequest({}, calls), {}, ["/admin/products/x", undefined, false])
  expect(calls).toHaveLength(1)
})
