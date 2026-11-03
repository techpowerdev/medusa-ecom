import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"
import type { Headers } from "./medusa"

/**
 * FS-18 (spec 03 กฎข้อ 23b): ล้างข้อมูลที่ suite สร้างผ่าน admin API ตามลำดับที่ให้ (order ที่ต้องยกเลิกก่อน → โปรโมชัน → แคมเปญ
 * → สินค้า → collection) ทำครบทุกตัวก่อนแล้วจึงตรวจ `ok()` ทุกตัว — request ที่ล้มไม่ทำให้รายการถัดไปค้าง (collection ค้างใน footer)
 * path ปกติ = DELETE; ขึ้นต้นด้วย `"POST "` = POST (เช่น ยกเลิก order เพื่อคืน reservation ก่อนลบสินค้า)
 * path ที่เป็น falsy (id ที่ beforeAll ยังไม่ได้สร้าง) ถูกข้าม
 */
export async function deleteAllThenExpectOk(
  request: APIRequestContext,
  admin: Headers,
  paths: (string | false | undefined)[]
) {
  const failed: string[] = []
  for (const entry of paths) {
    if (!entry) continue
    const post = entry.startsWith("POST ")
    const path = post ? entry.slice("POST ".length) : entry
    const what = `${post ? "POST" : "DELETE"} ${path}`
    try {
      const url = `${BACKEND_URL}${path}`
      const res = post
        ? await request.post(url, { headers: admin })
        : await request.delete(url, { headers: admin })
      if (!res.ok()) failed.push(`${what}: ${res.status()} ${await res.text()}`)
    } catch (e) {
      failed.push(`${what}: ${(e as Error).message}`)
    }
  }
  expect(failed, "ทุก request ล้างข้อมูลต้อง ok()").toEqual([])
}

/**
 * FS-18 (AC-25): ยืนยันด้วย admin API ว่าไม่เหลือสินค้า/collection ที่ชื่อมี run id ของ suite (`count = 0`)
 * นับเฉพาะ handle ที่ขึ้นต้นด้วย `handlePrefix` ของ suite (run id เป็นเวลา ms — suite ที่รันขนานกันอาจได้ค่าเดียวกัน)
 */
export async function expectNoneLeft(
  request: APIRequestContext,
  admin: Headers,
  run: string,
  handlePrefix: string
) {
  for (const resource of ["products", "collections"]) {
    const res = await request.get(`${BACKEND_URL}/admin/${resource}`, {
      headers: admin,
      params: { q: run, fields: "id,handle", limit: 100 },
    })
    expect(res.ok(), `GET /admin/${resource}?q=${run}: ${res.status()}`).toBe(true)
    const left = ((await res.json())[resource] as { handle: string }[])
      .map((r) => r.handle)
      .filter((h) => h.startsWith(handlePrefix))
    expect(left, `${resource} ที่ชื่อมี ${run} ยังเหลือ`).toEqual([])
  }
}
