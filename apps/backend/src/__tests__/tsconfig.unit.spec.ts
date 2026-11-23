import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"
import ts from "typescript"

// OPS-34 (spec 07 กฎข้อ 16 a รอบ 41, AC-49 a): `.medusa/types` ที่ `medusa build/develop` สร้างในเครื่อง (ไม่มีใน CI)
// augment type ของ query.graph จน test ที่ผ่านใน CI ล้ม TS2531 — `pnpm typecheck` ต้องไม่เห็นไฟล์ใต้ `.medusa/`
const BACKEND_DIR = path.resolve(__dirname, "../..")

describe("backend tsconfig.json", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "ops34-tsconfig-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("does not pick up generated files under .medusa/ (types, server, admin)", () => {
    const { config, error } = ts.readConfigFile(path.join(BACKEND_DIR, "tsconfig.json"), ts.sys.readFile)
    expect(error).toBeUndefined()
    for (const file of ["src/app.ts", ".medusa/types/query-entry-points.d.ts", ".medusa/server/src/app.ts"]) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), "export {}\n")
    }

    const { fileNames } = ts.parseJsonConfigFileContent(config, ts.sys, dir)

    const relative = fileNames.map((f) => path.relative(dir, f).split(path.sep).join("/"))
    expect(relative).toContain("src/app.ts")
    expect(relative.filter((f) => f.startsWith(".medusa/"))).toEqual([])
  })
})
