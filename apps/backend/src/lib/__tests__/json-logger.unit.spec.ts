import { Writable } from "stream"
import { buildJsonLogger } from "../json-logger"

// OPS-3 (spec 07 AC-18, ADR-012 ภาคผนวก): log JSON ของ backend มี field `worker_mode` จาก env MEDUSA_WORKER_MODE
// เพื่อให้กฎ alert `Error running event bus worker` กรองเฉพาะ process worker ได้

/** เก็บบรรทัด JSON ที่ logger เขียนออก */
function capture() {
  const lines: Record<string, unknown>[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        lines.push(JSON.parse(line))
      }
      callback()
    },
  })
  return { lines, stream }
}

describe("buildJsonLogger (OPS-3, AC-18)", () => {
  it("log ของ event bus worker บน process worker มี level error และ worker_mode: worker", () => {
    const { lines, stream } = capture()
    const logger = buildJsonLogger({ NODE_ENV: "production", MEDUSA_WORKER_MODE: "worker" }, stream)!

    // เรียกแบบเดียวกับ @medusajs/event-bus-redis 2.22.1 (services/event-bus-redis.js)
    const error = new Error("Connection is closed.")
    logger.error(`Error running event bus worker: ${error.message}`, error)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual(
      expect.objectContaining({
        level: "error",
        worker_mode: "worker",
        message: expect.stringContaining("Error running event bus worker"),
      })
    )
  })

  it("ทุก level มี worker_mode ตาม env (server)", () => {
    const { lines, stream } = capture()
    const logger = buildJsonLogger({ NODE_ENV: "production", MEDUSA_WORKER_MODE: "server" }, stream)!

    logger.info("hello")
    logger.warn("careful")

    expect(lines.map((line) => [line.level, line.worker_mode])).toEqual([
      ["info", "server"],
      ["warn", "server"],
    ])
  })

  it("ไม่ตั้ง MEDUSA_WORKER_MODE → worker_mode: shared (ค่า default ของ workerMode ใน medusa-config)", () => {
    const { lines, stream } = capture()
    const logger = buildJsonLogger({ NODE_ENV: "production" }, stream)!

    logger.info("hello")

    expect(lines[0]).toEqual(expect.objectContaining({ worker_mode: "shared", message: "hello" }))
  })

  it("development → undefined (ใช้ logger ของ Medusa ตามเดิม: format CLI + spinner)", () => {
    expect(buildJsonLogger({ NODE_ENV: "development", MEDUSA_WORKER_MODE: "worker" })).toBeUndefined()
    expect(buildJsonLogger({})).toBeUndefined()
  })
})

describe("medusa-config ส่ง logger ของ OPS-3 ให้ Medusa (top-level `logger` ของ defineConfig)", () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  function loadLogger(env: Record<string, string>) {
    Object.assign(process.env, env)
    let config: { logger?: unknown } | undefined
    jest.isolateModules(() => {
      config = require("../../../medusa-config")
    })
    return config!.logger
  }

  it("NODE_ENV ที่ไม่ใช่ development → มี logger", () => {
    expect(loadLogger({ NODE_ENV: "test", MEDUSA_WORKER_MODE: "worker" })).toEqual(
      expect.objectContaining({ error: expect.any(Function), activity: expect.any(Function) })
    )
  })

  it("development → ไม่ตั้ง logger (Medusa ใช้ค่า default)", () => {
    expect(loadLogger({ NODE_ENV: "development" })).toBeUndefined()
  })
})
