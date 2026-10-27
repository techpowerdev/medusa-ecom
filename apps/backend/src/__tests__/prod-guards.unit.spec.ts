import { readFileSync } from "fs"
import path from "path"
import { buildNotificationProviders } from "../lib/notification-providers"
import { seedPaymentProviders } from "../lib/prod-guards"
import { goLiveFailures } from "../scripts/check-go-live"
import type { MedusaContainer } from "@medusajs/framework/types"

// OPS-7 (docs/spec/07-scaling-ops.md AC-9, AC-10, AC-13, AC-17; ADR-010 C + D1); OPS-13 (AC-20, AC-21)
const repoRoot = path.resolve(__dirname, "../../../..")

const ENV_KEYS = [
  "NODE_ENV",
  "ALLOW_TEST_PROVIDERS",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "AFFILIATE_TOKEN_SECRET",
  "STOREFRONT_URL",
  "REDIS_URL",
  "MEDUSA_WORKER_MODE",
] as const

type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>

const PROD: Env = {
  NODE_ENV: "production",
  RESEND_API_KEY: "re_from_env",
  RESEND_FROM_EMAIL: "Shop <shop@example.com>",
  AFFILIATE_TOKEN_SECRET: "secret-from-env",
  STOREFRONT_URL: "https://shop.example.com",
}

function loadConfig(env: Env) {
  // "" แทนการลบ — loadEnv() ใน medusa-config ไม่เอาค่าจาก .env ในเครื่องมาทับ
  for (const key of ENV_KEYS) {
    process.env[key] = ""
  }
  Object.assign(process.env, env)
  jest.isolateModules(() => {
    require("../../medusa-config")
  })
}

describe("AC-9 buildNotificationProviders ใน production (ADR-010)", () => {
  it.each([
    ["RESEND_API_KEY", { NODE_ENV: "production", RESEND_FROM_EMAIL: "shop@example.com" }],
    ["RESEND_FROM_EMAIL", { NODE_ENV: "production", RESEND_API_KEY: "re_x" }],
    ["RESEND_API_KEY, RESEND_FROM_EMAIL", { NODE_ENV: "production" }],
  ])("throws naming %s when missing", (missing, env) => {
    expect(() => buildNotificationProviders(env)).toThrow(missing)
  })

  it("ALLOW_TEST_PROVIDERS=true keeps the local provider for email", () => {
    const providers = buildNotificationProviders({ NODE_ENV: "production", ALLOW_TEST_PROVIDERS: "true" })
    expect(providers).toEqual([
      expect.objectContaining({ id: "local", options: expect.objectContaining({ channels: ["feed", "email"] }) }),
    ])
  })

  it("other values of ALLOW_TEST_PROVIDERS do not disable the guard", () => {
    expect(() => buildNotificationProviders({ NODE_ENV: "production", ALLOW_TEST_PROVIDERS: "1" })).toThrow(
      "RESEND_API_KEY"
    )
  })

  it("outside production keeps the local fallback", () => {
    expect(buildNotificationProviders({ NODE_ENV: "development" })[0].id).toEqual("local")
    expect(buildNotificationProviders({})[0].id).toEqual("local")
  })

  it("production with both values uses Resend", () => {
    const providers = buildNotificationProviders(PROD)
    expect(providers.map((p) => p.id)).toEqual(["local", "resend"])
  })
})

describe("AC-10 payment providers ที่ seed เปิดให้ region Thailand", () => {
  const STRIPE = ["pp_stripe_stripe", "pp_stripe-promptpay_stripe"]

  it("production without ALLOW_TEST_PROVIDERS → Stripe only", () => {
    expect(seedPaymentProviders({ NODE_ENV: "production" })).toEqual(STRIPE)
  })

  it("production with ALLOW_TEST_PROVIDERS=true and non-production → includes pp_system_default", () => {
    expect(seedPaymentProviders({ NODE_ENV: "production", ALLOW_TEST_PROVIDERS: "true" })).toEqual([
      "pp_system_default",
      ...STRIPE,
    ])
    expect(seedPaymentProviders({ NODE_ENV: "development" })).toEqual(["pp_system_default", ...STRIPE])
  })
})

describe("AC-13 / AC-17 boot guards ใน medusa-config", () => {
  const original = { ...process.env }
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
    process.env = { ...original }
  })

  it("boots in production when everything is set", () => {
    expect(() => loadConfig(PROD)).not.toThrow()
    expect(warn).not.toHaveBeenCalled()
  })

  it("AC-13 production without AFFILIATE_TOKEN_SECRET throws with the variable name", () => {
    expect(() => loadConfig({ ...PROD, AFFILIATE_TOKEN_SECRET: "" })).toThrow("AFFILIATE_TOKEN_SECRET")
  })

  it.each([[""], ["shop.example.com"], ["ftp://shop.example.com"], ["https://"], ["http://exa mple.com"]])(
    "AC-17 production with STOREFRONT_URL=%j throws with the variable name",
    (value) => {
      expect(() => loadConfig({ ...PROD, STOREFRONT_URL: value })).toThrow("STOREFRONT_URL")
    }
  )

  it("ALLOW_TEST_PROVIDERS does not disable the AFFILIATE_TOKEN_SECRET / STOREFRONT_URL guards", () => {
    expect(() =>
      loadConfig({ ...PROD, ALLOW_TEST_PROVIDERS: "true", AFFILIATE_TOKEN_SECRET: "" })
    ).toThrow("AFFILIATE_TOKEN_SECRET")
    expect(() => loadConfig({ ...PROD, ALLOW_TEST_PROVIDERS: "true", STOREFRONT_URL: "" })).toThrow(
      "STOREFRONT_URL"
    )
  })

  it("outside production warns once per missing variable at boot", () => {
    loadConfig({ NODE_ENV: "development" })

    const messages = warn.mock.calls.map((call) => String(call[0]))
    expect(messages.filter((m) => m.includes("AFFILIATE_TOKEN_SECRET"))).toHaveLength(1)
    expect(messages.filter((m) => m.includes("STOREFRONT_URL"))).toHaveLength(1)
  })

  it("outside production with both set does not warn", () => {
    loadConfig({ NODE_ENV: "development", AFFILIATE_TOKEN_SECRET: "x", STOREFRONT_URL: "http://localhost:8000" })
    expect(warn).not.toHaveBeenCalled()
  })
  const testProviderWarnings = () =>
    warn.mock.calls.map((call) => String(call[0])).filter((m) => m.includes("ALLOW_TEST_PROVIDERS"))

  it("AC-20 production with ALLOW_TEST_PROVIDERS=true still boots and warns exactly once", () => {
    expect(() => loadConfig({ ...PROD, ALLOW_TEST_PROVIDERS: "true" })).not.toThrow()
    expect(testProviderWarnings()).toHaveLength(1)
  })

  it.each([
    ["production without the variable", { ...PROD }],
    ["production with an empty value", { ...PROD, ALLOW_TEST_PROVIDERS: "" }],
    ["development with ALLOW_TEST_PROVIDERS=true", { NODE_ENV: "development", ALLOW_TEST_PROVIDERS: "true" }],
  ])("AC-20 %s does not warn about ALLOW_TEST_PROVIDERS", (_label, env) => {
    loadConfig(env)
    expect(testProviderWarnings()).toHaveLength(0)
  })
})

/** env ระดับ job (บรรทัดย่อหน้า 6 ช่องใต้ `    env:`) ของแต่ละ job ใน ci.yml */
function ciJobs(yml: string): Record<string, { body: string; env: Record<string, string> }> {
  const lines = yml.split(/\r?\n/)
  const start = lines.findIndex((l) => l === "jobs:")
  const jobs: Record<string, { body: string; env: Record<string, string> }> = {}
  let current: string | null = null
  let inEnv = false
  for (const line of lines.slice(start + 1)) {
    const job = /^ {2}([\w-]+):\s*$/.exec(line)
    if (job) {
      current = job[1]
      jobs[current] = { body: "", env: {} }
      inEnv = false
      continue
    }
    if (!current) {
      continue
    }
    jobs[current].body += `${line}\n`
    if (/^ {4}\S/.test(line)) {
      inEnv = /^ {4}env:\s*$/.test(line)
      continue
    }
    const entry = /^ {6}([A-Z_][A-Z0-9_]*):\s*(.*)$/.exec(line)
    if (inEnv && entry) {
      jobs[current].env[entry[1]] = entry[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "")
    }
  }
  return jobs
}

describe("AC-13 / AC-17 ci.yml และ .env.example", () => {
  const jobs = ciJobs(readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8"))
  // job ที่บูต backend แบบ production: `medusa start` (NODE_ENV default = production) หรือ image prod (smoke ใน tools/ops)
  const prodJobs = Object.keys(jobs).filter((name) => /medusa start|tools\/ops\/smoke-/.test(jobs[name].body))

  it("finds the production-mode jobs", () => {
    expect(prodJobs).toEqual(expect.arrayContaining(["storefront-e2e", "docker-worker-mode"]))
  })

  it.each(["AFFILIATE_TOKEN_SECRET", "STOREFRONT_URL"])("every production-mode job sets %s", (key) => {
    for (const name of prodJobs) {
      expect({ job: name, value: jobs[name].env[key] }).toEqual({ job: name, value: expect.stringMatching(/\S/) })
    }
  })

  it("every production-mode job sets ALLOW_TEST_PROVIDERS=true (ADR-010 ข้อ 4)", () => {
    for (const name of prodJobs) {
      expect({ job: name, value: jobs[name].env.ALLOW_TEST_PROVIDERS }).toEqual({ job: name, value: "true" })
    }
  })

  it("STOREFRONT_URL in CI is an http(s) URL", () => {
    for (const name of prodJobs) {
      expect(jobs[name].env.STOREFRONT_URL).toMatch(/^https?:\/\/\S+$/)
    }
  })

  it("apps/backend/.env.example has a STOREFRONT_URL= line", () => {
    const envExample = readFileSync(path.resolve(__dirname, "../../.env.example"), "utf8")
    expect(envExample.split(/\r?\n/).some((l) => /^STOREFRONT_URL=/.test(l))).toBe(true)
  })
})

describe("AC-11 Go-live checklist ใน docs/ops/production.md", () => {
  const doc = readFileSync(path.join(repoRoot, "docs/ops/production.md"), "utf8")
  const lines = doc.split(/\r?\n/)
  const start = lines.indexOf("## Go-live checklist")
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line))
  const body = lines.slice(start + 1, end < 0 ? undefined : end).join("\n")

  it("มีหัวข้อและอ้างคำสั่ง check:go-live", () => {
    expect(start).toBeGreaterThan(-1)
    expect(body).toContain("pnpm --filter backend check:go-live")
    expect(body).toContain("ALLOW_TEST_PROVIDERS")
    expect(body).toContain("pp_system_default")
  })

  it("AC-21 มีข้อ Q-F1: ค่าส่ง Standard / Standard return ยังเป็น placeholder shipping_rate", () => {
    const item = body.split("\n").find((line) => line.includes("Q-F1")) ?? ""
    expect(item).toContain("shipping_rate")
    expect(item).toContain("Standard return")
  })

  it("AC-21 ข้อที่พูดถึงค่าว่างของ ALLOW_TEST_PROVIDERS ระบุว่าไม่ตั้งกับตั้งเป็นค่าว่างนับเหมือนกัน", () => {
    const item = body.split("\n").find((line) => line.includes("ALLOW_TEST_PROVIDERS") && line.includes("ค่าว่าง")) ?? ""
    expect(item).toContain("ไม่ตั้ง")
    expect(item).toContain("เหมือนกัน")
  })

  it("AC-21 check:go-live นับ ALLOW_TEST_PROVIDERS ที่ไม่ตั้งกับค่าว่างเหมือนกัน แต่ค่าอื่นทุกค่าไม่ผ่าน", async () => {
    const container = { resolve: () => ({ graph: async () => ({ data: [] }) }) } as unknown as MedusaContainer
    const env = { NODE_ENV: "production", STRIPE_API_KEY: "sk_live_from_env" }
    const flagged = async (value?: string) =>
      (await goLiveFailures(container, { ...env, ALLOW_TEST_PROVIDERS: value })).some((f) => f.includes("ALLOW_TEST_PROVIDERS"))

    expect(await flagged(undefined)).toBe(false)
    expect(await flagged("")).toBe(false)
    expect(await flagged("true")).toBe(true)
    expect(await flagged("false")).toBe(true)
  })

  it("package.json ของ backend มี script check:go-live ที่รันผ่าน medusa exec", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"))
    expect(pkg.scripts["check:go-live"]).toEqual("medusa exec ./src/scripts/check-go-live.ts")
  })
})
