import { execFileSync } from "child_process"
import path from "path"
import { releaseIdlePgConnections } from "../../integration-tests/pg-pool"

// OPS-15 (docs/spec/07-scaling-ops.md AC-26): medusa-test-utils restore DB จาก template ก่อนทุก test
// ด้วย pg_terminate_backend → connection ที่ค้างใน pool ของ app ตายแล้วถูกหยิบมาใช้ซ้ำ จึงต้องปล่อย pool
// ของ PG_CONNECTION ก่อน restore (beforeEach ระดับบนสุดรันก่อน beforeEach ของ runner)
const BACKEND_DIR = path.resolve(__dirname, "../..")
const JEST_BIN = require.resolve("jest/bin/jest")

function fakeContainer(registered: boolean) {
  const calls: string[] = []
  const knex = {
    destroy: jest.fn(async () => {
      calls.push("destroy")
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

describe("releaseIdlePgConnections (OPS-15)", () => {
  it("ปิด pool เดิมแล้วสร้าง pool ใหม่บน knex instance เดิม (destroy ก่อน initialize)", async () => {
    const { container, calls } = fakeContainer(true)
    await releaseIdlePgConnections(container)
    expect(calls).toEqual(["destroy", "initialize"])
  })

  it("ไม่ทำอะไรเมื่อ app ยังไม่ register PG_CONNECTION (ก่อน beforeAll ของ runner)", async () => {
    const { container, knex } = fakeContainer(false)
    await releaseIdlePgConnections(container)
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
