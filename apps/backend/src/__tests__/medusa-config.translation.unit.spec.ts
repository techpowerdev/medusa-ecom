// CORE-7 (docs/spec/01-core-medusa.md, ADR-008): เปิด Translation module ของ Medusa
// ตาม docs "Configure Translation Module" — ใส่ module ใน `modules` + feature flag `translation`
type LoadedConfig = {
  featureFlags?: Record<string, unknown>
  modules?: Record<string, { resolve?: string; disable?: boolean } | boolean>
}

function loadConfig() {
  let config: LoadedConfig | undefined
  jest.isolateModules(() => {
    config = require("../../medusa-config")
  })
  return config as LoadedConfig
}

describe("medusa-config translation", () => {
  it("enables the translation feature flag", () => {
    expect(loadConfig().featureFlags).toMatchObject({ translation: true })
  })

  it("registers the Translation module and does not disable it", () => {
    const modules = Object.values(loadConfig().modules ?? {})
    const translation = modules.find(
      (m) => typeof m === "object" && m.resolve === "@medusajs/medusa/translation"
    )

    expect(translation).toBeDefined()
    expect(translation).not.toMatchObject({ disable: true })
  })
})
