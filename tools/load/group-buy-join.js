// OPS-4 (spec 07 AC-3): ลูกค้า N คน (200) join pool group เดียวกันพร้อมกัน (max_people_per_group = 10)
// ผลที่ยอมรับ: 201 หรือ 409 — จำนวนสมาชิกตรวจจาก DB หลังจบ (tools/load/run.sh); gate = 5xx = 0 และไม่มีผลอื่น
import http from "k6/http"
import exec from "k6/execution"
import { Counter } from "k6/metrics"
import { BASE_URL, createCarts, customersOf, headersOf, meta, track } from "./common.js"

const customers = customersOf("group_buy")

const joined = new Counter("join_joined")
const rejected = new Counter("join_rejected")
const unexpected = new Counter("join_unexpected")

export const options = {
  setupTimeout: "10m",
  scenarios: {
    join: { executor: "per-vu-iterations", vus: customers.length, iterations: 1, maxDuration: "5m" },
  },
  thresholds: {
    http_5xx: ["count==0"],
    join_unexpected: ["count==0"],
    "http_req_duration{scenario:join}": ["max>=0"],
  },
}

export function setup() {
  return createCarts(customers, meta.group_buy.variant_id)
}

export default function (carts) {
  const c = carts[exec.scenario.iterationInTest]
  const res = track(
    http.post(
      `${BASE_URL}/store/group-buy/groups/${meta.group_buy.join_token}/join`,
      JSON.stringify({ cart_id: c.cart_id }),
      headersOf(c.token)
    )
  )
  if (res.status === 201) {
    joined.add(1)
  } else if (res.status === 409) {
    rejected.add(1)
  } else {
    unexpected.add(1)
    console.error(`join ${c.cart_id}: ${res.status} ${String(res.body).slice(0, 300)}`)
  }
}
