// OPS-4 (spec 07 AC-2, Q-O3 c): flash-sale burst
// - checkout: ลูกค้า N คน (300) complete checkout คนละ 1 ชิ้นพร้อมกัน แข่งกับ total_cap (100) ด้วย manual payment
//   ผลที่ยอมรับ: order หรือ 409 FLASH_SOLD_OUT — จำนวน order ที่ได้ส่วนลดตรวจจาก DB หลังจบ (tools/load/run.sh)
// - burst: add-to-cart / อ่าน cart ของลูกค้ากลุ่มเดียวกัน RATE request/วินาที นาน DURATION ระหว่าง checkout
// gate = 5xx = 0 และ checkout ไม่มีผลอื่น; p95 รายงานอย่างเดียว (threshold "max>=0" แค่ให้ summary แยกตาม scenario)
import http from "k6/http"
import exec from "k6/execution"
import { Counter } from "k6/metrics"
import { BASE_URL, batchPost, createCarts, customersOf, headersOf, meta, track } from "./common.js"

const customers = customersOf("flash")
const N = customers.length

const ordersPlaced = new Counter("checkout_orders")
const soldOut = new Counter("checkout_sold_out")
const unexpected = new Counter("checkout_unexpected")
const burstErrors = new Counter("burst_non_2xx")

export const options = {
  setupTimeout: "15m",
  scenarios: {
    // VU ของ burst ≤ N และของ checkout = N → idInTest ไม่เกิน 2N = จำนวน burst cart (cart ละ VU เดียว ไม่แย่ง lock ของ cart)
    burst: {
      executor: "constant-arrival-rate",
      exec: "burst",
      rate: Number(__ENV.LOAD_BURST_RATE || 500),
      timeUnit: "1s",
      duration: __ENV.LOAD_BURST_DURATION || "60s",
      preAllocatedVUs: N,
      maxVUs: N,
    },
    checkout: {
      executor: "per-vu-iterations",
      exec: "checkout",
      vus: N,
      iterations: 1,
      startTime: __ENV.LOAD_CHECKOUT_START || "10s",
      maxDuration: "5m",
    },
  },
  thresholds: {
    http_5xx: ["count==0"],
    checkout_unexpected: ["count==0"],
    "http_req_duration{scenario:burst}": ["max>=0"],
    "http_req_duration{scenario:checkout}": ["max>=0"],
  },
}

const ADDRESS = {
  first_name: "Load",
  last_name: "Test",
  address_1: "1 Sukhumvit",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

export function setup() {
  const checkout = createCarts(customers, meta.flash.variant_id, { shipping_address: ADDRESS })
  batchPost(
    checkout.map((c) => ({
      path: `/store/carts/${c.cart_id}/shipping-methods`,
      token: c.token,
      body: { option_id: meta.shipping_option_id },
    })),
    "shipping method"
  )
  const collections = batchPost(
    checkout.map((c) => ({ path: "/store/payment-collections", token: c.token, body: { cart_id: c.cart_id } })),
    "payment collection"
  )
  batchPost(
    collections.map((b, i) => ({
      path: `/store/payment-collections/${b.payment_collection.id}/payment-sessions`,
      token: checkout[i].token,
      body: { provider_id: "pp_system_default" },
    })),
    "payment session"
  )
  const owners = Array.from({ length: 2 * N }, (_, i) => customers[i % N])
  return { checkout, burst: createCarts(owners, meta.flash.variant_id) }
}

export function burst(data) {
  const c = data.burst[(exec.vu.idInTest - 1) % data.burst.length]
  const res = track(
    exec.scenario.iterationInTest % 2
      ? http.get(`${BASE_URL}/store/carts/${c.cart_id}`, headersOf(c.token))
      : http.post(
          `${BASE_URL}/store/carts/${c.cart_id}/line-items`,
          JSON.stringify({ variant_id: meta.flash.variant_id, quantity: 1 }),
          headersOf(c.token)
        )
  )
  burstErrors.add(res.status >= 200 && res.status < 300 ? 0 : 1)
}

export function checkout(data) {
  const c = data.checkout[exec.scenario.iterationInTest]
  const res = track(http.post(`${BASE_URL}/store/carts/${c.cart_id}/complete`, "{}", headersOf(c.token)))
  const body = res.status ? res.json() : {}
  if (res.status === 200 && body.type === "order") {
    ordersPlaced.add(1)
  } else if (res.status === 409 && body.code === "FLASH_SOLD_OUT") {
    soldOut.add(1)
  } else {
    unexpected.add(1)
    console.error(`checkout ${c.cart_id}: ${res.status} ${String(res.body).slice(0, 300)}`)
  }
}
