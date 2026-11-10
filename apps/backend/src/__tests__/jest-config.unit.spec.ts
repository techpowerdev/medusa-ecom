import { execFileSync } from "child_process"
import { readdirSync } from "fs"
import path from "path"

// OPS-6 (docs/spec/07-scaling-ops.md AC-8): ทุก unit spec ถูกรันใน test:unit ครั้งเดียว —
// test:integration:modules ต้องไม่จับ *.unit.spec.* ซ้ำ และ test:unit ต้องไม่จับ integration ของ module
const BACKEND_DIR = path.resolve(__dirname, "../..")
const JEST_BIN = require.resolve("jest/bin/jest")
const UNIT_SPEC = /\.unit\.spec\.[jt]s$/

function listTests(testType: string): string[] {
  const out = execFileSync(process.execPath, [JEST_BIN, "--listTests"], {
    cwd: BACKEND_DIR,
    env: { ...process.env, TEST_TYPE: testType },
    encoding: "utf8",
  })
  return out
    .split("\n")
    .filter(Boolean)
    .map((file) => path.relative(BACKEND_DIR, file))
    .sort()
}

function findFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) =>
      path.relative(BACKEND_DIR, path.join(entry.parentPath, entry.name))
    )
    .sort()
}

describe("jest.config.js testMatch (AC-8)", () => {
  const unit = listTests("unit")
  const modules = listTests("integration:modules")

  it("integration:modules ไม่มีไฟล์ *.unit.spec.*", () => {
    expect(modules.filter((file) => UNIT_SPEC.test(file))).toEqual([])
    // ยังจับ integration test ของ module อยู่
    expect(modules.length).toBeGreaterThan(0)
  })

  it("unit ไม่มีไฟล์ integration ของ module", () => {
    expect(unit.filter((file) => !UNIT_SPEC.test(file))).toEqual([])
  })

  it("ทุก *.unit.spec.* ใต้ src ถูกรันใน test:unit ครั้งเดียว", () => {
    expect(unit).toEqual(findFiles(path.join(BACKEND_DIR, "src"), UNIT_SPEC))
  })
})

// hotfix CI OOM (run 40202689427): integration test ต้องรันทีละ suite ใน worker เดียวที่ถูก recycle
// เมื่อ heap เกินขีด แทน --runInBand ที่สะสมหน่วยความจำทุก suite ใน process เดียวจน heap เต็ม
describe("integration test ใช้ worker เดียวที่ถูก recycle (CI OOM)", () => {
  const pkg = require(path.join(BACKEND_DIR, "package.json"))

  function globalConfig(testType: string) {
    const out = execFileSync(process.execPath, [JEST_BIN, "--showConfig"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, TEST_TYPE: testType },
      encoding: "utf8",
    })
    return JSON.parse(out).globalConfig
  }

  it.each(["test:integration:http", "test:integration:modules"])(
    "script %s ไม่ใช้ --runInBand",
    (script) => {
      expect(pkg.scripts[script]).not.toMatch(/--runInBand|\s-i(\s|$)/)
    }
  )

  it.each(["integration:http", "integration:modules"])(
    "%s: maxWorkers = 1 และตั้ง workerIdleMemoryLimit",
    (testType) => {
      const config = globalConfig(testType)
      expect(config.maxWorkers).toBe(1)
      expect(config.workerIdleMemoryLimit).toBeGreaterThan(0)
    }
  )
})
