import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

// OPS-6 (docs/spec/07-scaling-ops.md AC-6): image เล็กด้วย standalone output
// และไม่ให้ `next dev` สร้าง AGENTS.md/CLAUDE.md เมื่อรันภายใต้ AI agent (AC-7)
describe("next.config.js — OPS-6 (AC-6)", () => {
  // next.config.js เรียก checkEnvVariables() ซึ่ง process.exit ถ้าไม่มี publishable key
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??= "pk_test_ops6"
  const nextConfig = createRequire(import.meta.url)("../next.config.js") as {
    output?: string
    agentRules?: boolean
  }

  it('ใช้ output: "standalone"', () => {
    expect(nextConfig.output).toBe("standalone")
  })

  it("ปิด agentRules", () => {
    expect(nextConfig.agentRules).toBe(false)
  })
})
