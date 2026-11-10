// OPS-4: ส่วนที่ k6 script ใช้ร่วมกัน — ข้อมูลจาก seed-load (apps/backend/src/scripts/seed-load.ts)
import http from "k6/http"
import { fail } from "k6"
import { SharedArray } from "k6/data"
import { Counter } from "k6/metrics"

export const BASE_URL = __ENV.BASE_URL || "http://server:9000"
const FILE = __ENV.LOAD_DATA || "/data/load-data.json"

// SharedArray: parse ไฟล์ครั้งเดียวและแชร์ระหว่าง VU (token ของลูกค้าหลายร้อยคน)
export const meta = new SharedArray("meta", () => {
  const d = JSON.parse(open(FILE))
  return [{ ...d, flash: { ...d.flash, customers: [] }, group_buy: { ...d.group_buy, customers: [] } }]
})[0]
export const customersOf = (kind) => new SharedArray(kind, () => JSON.parse(open(FILE))[kind].customers)

// AC-2/AC-3: 5xx = 0 เป็น gate — เพิ่ม 0 ทุก response เพื่อให้ metric มีค่าเสมอ
export const http5xx = new Counter("http_5xx")

export const headersOf = (token) => ({
  headers: {
    "content-type": "application/json",
    "x-publishable-api-key": meta.publishable_key,
    authorization: `Bearer ${token}`,
  },
  timeout: "120s",
})

export function track(res) {
  http5xx.add(res.status >= 500 ? 1 : 0)
  return res
}

/** POST ทีละชุดใน setup — ล้มทั้ง test ถ้า response ใดไม่ใช่ 200 */
export function batchPost(requests, label) {
  const out = []
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50)
    const responses = http.batch(
      chunk.map((r) => ["POST", `${BASE_URL}${r.path}`, JSON.stringify(r.body), headersOf(r.token)])
    )
    responses.forEach((res) => {
      track(res)
      if (res.status !== 200) {
        fail(`${label}: ${res.status} ${String(res.body).slice(0, 300)}`)
      }
      out.push(res.json())
    })
  }
  return out
}

export const createCarts = (owners, variantId, extra = {}) =>
  batchPost(
    owners.map((c) => ({
      path: "/store/carts",
      token: c.token,
      body: { region_id: meta.region_id, items: [{ variant_id: variantId, quantity: 1 }], ...extra },
    })),
    "create cart"
  ).map((b, i) => ({ cart_id: b.cart.id, token: owners[i].token }))
