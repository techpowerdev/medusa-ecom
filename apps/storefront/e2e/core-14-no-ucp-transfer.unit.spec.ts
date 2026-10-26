import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-14 (spec 01 AC-42, AC-56, กฎ 24-25): storefront ไม่มี UCP, cart/resume และหน้า order transfer
// ตรวจที่ source (ไม่ต้องใช้ server) — route test ของ AC-42/AC-56 อยู่ใน core-14-buy-login.spec.ts
const SRC = path.resolve(__dirname, "..", "src")
const APP = path.join(SRC, "app")

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })

test("AC-42: ไม่มี route ของ UCP, cart/resume และ lib/ucp", () => {
  for (const removed of [
    path.join(APP, "ucp"),
    path.join(APP, ".well-known", "ucp"),
    path.join(APP, "[countryCode]", "(main)", "cart", "resume"),
    path.join(SRC, "lib", "ucp"),
  ]) {
    expect(fs.existsSync(removed), removed).toBe(false)
  }
  const usages = walk(SRC).filter((file) => /@lib\/ucp|\/ucp\/|cart\/resume/.test(fs.readFileSync(file, "utf8")))
  expect(usages).toEqual([])
})

test("AC-56: ไม่มีหน้า order transfer และไม่มีการเรียก /store/orders/*/transfer", () => {
  const transferDir = path.join(APP, "[countryCode]", "(main)", "order", "[id]", "transfer")
  expect(fs.existsSync(transferDir) ? walk(transferDir) : []).toEqual([])

  // sdk.store.order.{requestTransfer,acceptTransfer,declineTransfer,cancelTransfer} = /store/orders/:id/transfer/*
  const usages = walk(SRC).filter((file) =>
    /(request|accept|decline|cancel)Transfer\b|\/store\/orders\/[^"'`]*\/transfer/.test(
      fs.readFileSync(file, "utf8")
    )
  )
  expect(usages).toEqual([])
})
