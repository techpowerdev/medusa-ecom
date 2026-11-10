// OPS-1 (docs/spec/07-scaling-ops.md AC-1): image เดียวกันบูตเป็น server หรือ worker ตาม env
// ตาม Medusa worker mode — MEDUSA_WORKER_MODE + DISABLE_MEDUSA_ADMIN
type LoadedConfig = {
  projectConfig: { workerMode?: string }
  admin: { disable?: boolean; path?: string }
}

const ENV_KEYS = ["MEDUSA_WORKER_MODE", "DISABLE_MEDUSA_ADMIN"] as const

function loadConfig(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
  Object.assign(process.env, env)

  let config: LoadedConfig | undefined
  jest.isolateModules(() => {
    config = require("../../medusa-config")
  })
  return config as LoadedConfig
}

describe("medusa-config worker mode", () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it("boots as server with admin when MEDUSA_WORKER_MODE=server", () => {
    const config = loadConfig({
      MEDUSA_WORKER_MODE: "server",
      DISABLE_MEDUSA_ADMIN: "false",
    })

    expect(config.projectConfig.workerMode).toEqual("server")
    expect(config.admin.disable).toEqual(false)
    expect(config.admin.path).toEqual("/app")
  })

  it("boots as worker without admin when MEDUSA_WORKER_MODE=worker", () => {
    const config = loadConfig({
      MEDUSA_WORKER_MODE: "worker",
      DISABLE_MEDUSA_ADMIN: "true",
    })

    expect(config.projectConfig.workerMode).toEqual("worker")
    expect(config.admin.disable).toEqual(true)
  })

  it("defaults to shared with admin for local dev when env is unset", () => {
    const config = loadConfig({})

    expect(config.projectConfig.workerMode).toEqual("shared")
    expect(config.admin.disable).toEqual(false)
  })
})
