import { execFileSync } from "child_process"
import path from "path"
import { releaseIdlePgConnections } from "../../integration-tests/pg-pool"

// OPS-15 (docs/spec/07-scaling-ops.md AC-26): medusa-test-utils restore DB จาก template ก่อนทุก test
// ด้วย pg_terminate_backend → connection ที่ค้างใน pool ของ app ตายแล้วถูกหยิบมาใช้ซ้ำ จึงต้องปล่อย pool
// ของ PG_CONNECTION ก่อน restore (beforeEach ระดับบนสุดรันก่อน beforeEach ของ runner)
const BACKEND_DIR = path.resolve(__dirname, "../..")
const JEST_BIN = require.resolve("jest/bin/jest")

type PoolState = { used: number; acquires: number; creates: number }

function fakeContainer(registered: boolean, state: PoolState = { used: 0, acquires: 0, creates: 0 }) {
  const calls: string[] = []
  const knex = {
    client: {
      pool: {
        numUsed: () => state.used,
        numPendingAcquires: () => state.acquires,
        numPendingCreates: () => state.creates,
      },
    },
    destroy: jest.fn(async () => {
      // tarn abort acquire ที่รออยู่ — ถ้ายังมีงานค้างใน pool ถือว่าไป abort งานของ subscriber
      calls.push(state.used + state.acquires + state.creates > 0 ? "destroy-while-busy" : "destroy")
    }),
    initialize: jest.fn(() => {
      calls.push("initialize")
    }),
  }
  return {
    calls,
    knex,
    container: {
      hasRegistration: () => registered,
      resolve: () => knex,
    },
  }
}

const FAST = { intervalMs: 5, quietMs: 20, timeoutMs: 300 }

describe("releaseIdlePgConnections (OPS-15)", () => {
  it("ปิด pool เดิมแล้วสร้าง pool ใหม่บน knex instance เดิม (destroy ก่อน initialize)", async () => {
    const { container, calls } = fakeContainer(true)
    await releaseIdlePgConnections(container, FAST)
    expect(calls).toEqual(["destroy", "initialize"])
  })

  it.each([
    ["numUsed", { used: 1, acquires: 0, creates: 0 }],
    ["numPendingAcquires", { used: 0, acquires: 2, creates: 0 }],
    ["numPendingCreates", { used: 0, acquires: 0, creates: 1 }],
  ])("รอจน pool ว่าง (%s = 0) ก่อน destroy — ไม่ abort query ของ subscriber ที่ยังรันเบื้องหลัง", async (_, busy) => {
    const state = { ...busy }
    const { container, calls } = fakeContainer(true, state)
    setTimeout(() => Object.assign(state, { used: 0, acquires: 0, creates: 0 }), 60)
    await releaseIdlePgConnections(container, FAST)
    expect(calls).toEqual(["destroy", "initialize"])
  })

  it("pool ต้องว่างต่อเนื่องตลอด quietMs (subscriber ที่หยุดระหว่าง query ยังไม่จบ)", async () => {
    const state = { used: 0, acquires: 0, creates: 0 }
    const { container, calls } = fakeContainer(true, state)
    // ว่างสั้นๆ แล้วกลับมาใช้อีกครั้ง — ต้องไม่ destroy ในช่วงว่างแรก
    setTimeout(() => (state.used = 1), 8)
    setTimeout(() => (state.used = 0), 80)
    const started = Date.now()
    await releaseIdlePgConnections(container, FAST)
    expect(calls).toEqual(["destroy", "initialize"])
    expect(Date.now() - started).toBeGreaterThanOrEqual(80 + FAST.quietMs - 5)
  })

  it("pool ไม่ว่างจนหมดเวลา → ไม่ destroy (ไม่ abort งานค้าง; ขั้นนับใน CI จะเห็นถ้ามี connection ตาย)", async () => {
    const { container, knex } = fakeContainer(true, { used: 1, acquires: 0, creates: 0 })
    await releaseIdlePgConnections(container, FAST)
    expect(knex.destroy).not.toHaveBeenCalled()
    expect(knex.initialize).not.toHaveBeenCalled()
  })

  it("ไม่ทำอะไรเมื่อ app ยังไม่ register PG_CONNECTION (ก่อน beforeAll ของ runner)", async () => {
    const { container, knex } = fakeContainer(false)
    await releaseIdlePgConnections(container, FAST)
    expect(knex.destroy).not.toHaveBeenCalled()
    expect(knex.initialize).not.toHaveBeenCalled()
  })
})

describe("jest.config.js integration:http ใช้ setup ที่ปล่อย pool ก่อน restore (OPS-15)", () => {
  function projectConfig(testType: string) {
    const out = execFileSync(process.execPath, [JEST_BIN, "--showConfig"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, TEST_TYPE: testType },
      encoding: "utf8",
    })
    return JSON.parse(out).configs[0]
  }

  it("setupFilesAfterEnv มี integration-tests/setup-after-env", () => {
    const files: string[] = projectConfig("integration:http").setupFilesAfterEnv
    expect(files.map((f) => path.relative(BACKEND_DIR, f))).toContain(
      path.join("integration-tests", "setup-after-env.ts")
    )
  })
})
