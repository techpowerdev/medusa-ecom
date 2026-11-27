import { expect, test } from "@playwright/test"

import { readSource } from "./support/sfui-source"

// SFUI-8 (spec 09 กฎ 23a, AC-22): rule ป้ายลอยใน globals.css เดิม (`input:focus ~ label`, `input:not(:placeholder-shown) ~ label`)
// จับ <label> ทุกตัวที่ตามหลัง <input> พี่น้อง (เช่น option-button ที่มี radio sr-only นำหน้า) — ย้ายไปเป็น `peer` บน input +
// variant `peer-*` บน label ของ common/components/input เท่านั้น (SFUI-11a: ป้ายลอยถูกแทนด้วย label เหนือช่องแล้ว)

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

// SFUI-11a (spec 09 กฎ 27c, 28): floating label ถูกแทนด้วย label เหนือช่องของ `field` (AC-23 (1) / กฎ 23b ยกเลิก) —
// common/components/input ต้องไม่มี `peer` และ variant `peer-*` ของป้ายลอยเหลืออยู่
test("AC-22: common/components/input ไม่มี peer / peer-* ของป้ายลอยเดิม (label เหนือช่อง — SFUI-11a)", () => {
  const src = readSource("src/modules/common/components/input/index.tsx")
  const tokens = Array.from(src.matchAll(/className="([^"]*)"/g)).flatMap((m) => m[1].split(/\s+/))
  expect(tokens.filter((t) => /^peer(?:$|-|\/)/.test(t))).toEqual([])
  expect(src).not.toMatch(/\bpeer-(?:focus|not-placeholder-shown):/)
})
