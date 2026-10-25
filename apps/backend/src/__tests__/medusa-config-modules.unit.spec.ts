// กันการ resolve merge conflict ใน medusa-config.ts แล้ว module หลุด (เกิดแล้ว 2 ครั้ง: block admin, module flash_sale)
// ทุก custom module ที่มี data model (`src/modules/<name>/models`) ต้องลงทะเบียนใน `modules` ของ medusa-config.ts
// module ที่ไม่มี models (เช่น `resend` ซึ่งเป็น notification provider) ไม่นับ
import { existsSync, readdirSync } from "fs"
import { join } from "path"

type ModuleEntry = { resolve?: string } | boolean
// defineConfig แปลง `modules` เป็น object ที่ key ตามชื่อ module
type LoadedConfig = { modules?: ModuleEntry[] | Record<string, ModuleEntry> }

const MODULES_DIR = join(__dirname, "..", "modules")

function modulesWithModels(): string[] {
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(MODULES_DIR, name, "models")))
}

describe("medusa-config modules", () => {
  it("registers every custom module that has data models", () => {
    let config: LoadedConfig | undefined
    jest.isolateModules(() => {
      config = require("../../medusa-config")
    })
    const registered = Object.values(config?.modules ?? {}).map((m) =>
      typeof m === "object" ? m.resolve : undefined
    )

    const missing = modulesWithModels().filter(
      (name) => !registered.includes(`./src/modules/${name}`)
    )

    expect(missing).toEqual([])
  })

  // EV-3: ตั้งค่า fulfillment module เองแล้ว default `manual` จะหายถ้าไม่ระบุ (seed ใช้ manual_manual)
  it("registers fulfillment providers manual and digital", () => {
    let config: LoadedConfig | undefined
    jest.isolateModules(() => {
      config = require("../../medusa-config")
    })
    const fulfillment = Object.values(config?.modules ?? {}).find(
      (m) => typeof m === "object" && m.resolve === "@medusajs/medusa/fulfillment"
    ) as { options?: { providers?: { resolve: string; id: string }[] } } | undefined

    expect(fulfillment?.options?.providers).toEqual([
      expect.objectContaining({ resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" }),
      expect.objectContaining({ resolve: "./src/modules/digital_fulfillment", id: "digital" }),
    ])
  })
})
