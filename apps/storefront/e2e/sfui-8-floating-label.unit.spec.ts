import { expect, test } from "@playwright/test"

import { readSource } from "./support/sfui-source"

// SFUI-8 (spec 09 กฎ 23a, AC-22): rule ป้ายลอยใน globals.css เดิม (`input:focus ~ label`, `input:not(:placeholder-shown) ~ label`)
// จับ <label> ทุกตัวที่ตามหลัง <input> พี่น้อง (เช่น option-button ที่มี radio sr-only นำหน้า) — ย้ายไปเป็น `peer` บน input +
// variant `peer-*` บน label ของ common/components/input เท่านั้น

const css = readSource("src/styles/globals.css").replace(/\/\*[\s\S]*?\*\//g, "")

/** selector ทั้งหมดของ globals.css (ส่วนก่อน `{` ของทุก rule รวม rule ซ้อนใน @layer) */
const selectors = Array.from(css.matchAll(/([^{};]+)\{/g))
  .flatMap((m) => m[1].split(","))
  .map((s) => s.trim())
  .filter(Boolean)

test("AC-22: globals.css ไม่มี selector ที่ลงท้ายด้วย `~ label` / `+ label` โดย label ไม่มี class/attribute กำกับ", () => {
  expect(selectors.length, "อ่าน selector ของ globals.css ได้").toBeGreaterThan(10)
  const bare = selectors.filter((s) => /[~+]\s*label(?![\w.[#-])(?::[\w-]+(?:\([^)]*\))?)*$/.test(s))
  expect(bare).toEqual([])
})

test("AC-22: globals.css ไม่มี rule ป้ายลอยที่ผูกกับ `input` + `label` และไม่ @apply utility ขนาดฟอนต์ของ starter ใน rule ใดที่จับ label", () => {
  expect(selectors.filter((s) => /\binput\b[^,]*\blabel\b/.test(s))).toEqual([])
  const labelRules = Array.from(css.matchAll(/([^{};]*\blabel\b[^{};]*)\{([^}]*)\}/g)).map((m) => m[2])
  expect(labelRules.filter((body) => /text-(?:xsmall|small|base|large|xl|2xl|3xl)-(?:regular|semi)/.test(body))).toEqual([])
})

test("AC-22: ป้ายลอยของ common/components/input ผูกด้วย peer — input มี `peer` และ label มี variant peer-focus / peer-not-placeholder-shown ค่าตรง", () => {
  const src = readSource("src/modules/common/components/input/index.tsx")
  const inputClass = src.match(/<ShadcnInput[\s\S]*?className="([^"]*)"/)?.[1] ?? ""
  expect(inputClass.split(/\s+/)).toContain("peer")
  const labelClass = src.match(/<label[\s\S]*?className="([^"]*)"/)?.[1] ?? ""
  const classes = labelClass.split(/\s+/)
  for (const c of [
    "peer-focus:-translate-y-3",
    "peer-focus:text-[10px]",
    "peer-focus:leading-4",
    "peer-focus:font-normal",
    "peer-focus:left-0",
    "peer-focus:transition-all",
    "peer-focus:duration-300",
    "peer-not-placeholder-shown:-translate-y-3",
    "peer-not-placeholder-shown:text-[10px]",
    "peer-not-placeholder-shown:leading-4",
    "peer-not-placeholder-shown:font-normal",
  ]) {
    expect(classes, c).toContain(c)
  }
  expect(labelClass).not.toMatch(/text-(?:xsmall|small|base|large|xl|2xl|3xl)-(?:regular|semi)/)
})
