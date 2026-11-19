# QA — ADM-15: ฟอร์มสร้างแคมเปญ group buy ใช้ NumberInput และคืน focus (PR #374)

- **Spec**: `docs/spec/08-admin-ui-medusa-components.md` กฎ 19, AC-19 และ regression AC-10
- **Commit ที่ตรวจ**: `41e9a293` (merge `origin/develop` ที่ `ff502ff1` เข้า branch `feat/ADM-15-group-buy-create-campaign`) โค้ดของ PR คือ commit `2fc01cf9`
- **สภาพแวดล้อม**
  - backend และ admin เป็น prod build (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, `NODE_ENV=production`) ที่ port 9314
  - DB `medusa_qa374` สร้างใหม่ แล้วรัน migrate และ seed ใช้ Redis db 14
  - Node 22.23.3, Playwright Chromium, viewport 1280×800, `locale en-US`, `timezoneId Asia/Bangkok`
  - Stripe ใช้ test key เท่านั้น
- **report/trace ฉบับเต็ม**: CI artifact (Playwright report, 14 วัน) ของ PR #374

## ผล test อัตโนมัติ

| ชุด | ผล |
|-----|----|
| `e2e/group-buy-admin-form.spec.ts` ทั้งไฟล์ (AC-32, AC-50 ×3, AC-52, AC-10, AC-17, AC-19) | 7/7 ผ่าน (38.0s) |
| unit `group-buy-pages.unit.spec.ts` และ `group-buy-form.unit.spec.ts` (รวมส่วน static ของ AC-19) | 61/61 ผ่าน |
| static: `create-campaign.tsx` ไม่มี `type: "number"` / `type="number"` และ import `NumberInput` | ผ่าน (grep ไม่พบ, ใช้ `NumberInput` 3 จุด) |
| QA spec เพิ่มเติม (ชั่วคราว ไม่ commit) QA-2, QA-4, QA-5, QA-7 | 4/4 ผ่าน (QA-7 เก็บค่าเพื่อสังเกต) |

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-19 พิมพ์ `pressSequentially("e")` ในช่อง Max total orders แล้วส่ง: มี error ใต้ช่อง (`gb-max-total-orders-error`) และไม่มี POST | pass | `ac19-max-total-orders-e-error.png` |
| AC-19 ล้างช่องแล้วส่ง: POST 1 ครั้ง ได้ `max_total_orders: null` (HTTP 200) | pass | ผล e2e AC-19 และ QA-2 (body มี `"max_total_orders":null`) |
| AC-19 dblclick ปุ่ม "Create campaign": dialog 1 ตัว | pass | ผล e2e AC-19 |
| AC-19 ปิดด้วย Escape: focus กลับปุ่ม "Create campaign" | pass | `ac19-focus-ring-after-escape.png` (เห็น focus ring, `:focus-visible` = true) |
| AC-19 เปิดใหม่: ช่องชื่อเป็น `""` และได้ idempotency key ใหม่ | pass | ผล e2e AC-19 และ `qa6-ctrl-enter-reopen-empty.png` |
| AC-10 (regression) กรอกวันเวลาไทยแล้วกด Meta/Ctrl+Enter: POST 1 ครั้ง body เป็น UTC | pass | ผล e2e AC-10 |

## Checklist

| # | กรณี | ผล | Evidence |
|---|------|----|----------|
| 1 | "e" ใน Max total orders แล้วกด Create | pass: error ใต้ช่อง "Max total orders must be a whole number greater than 0", POST = 0 | `ac19-max-total-orders-e-error.png` |
| 2 | ค่าไม่ใช่ตัวเลขในอีก 7 ช่อง: Target value, Discount value (`1e`), Max discounted quantity, Team duration, Max units per person, Max people per group, Pay within (`-`) | pass: ทุกช่องมี error ใต้ช่องของตัวเอง ข้อความตรงกับ `toCampaignBody` และ POST = 0; แก้เป็นค่าถูกแล้วส่งได้ 200 | `qa2-other-numeric-fields-error.png` |
| 3 | ล้างช่องแล้วส่ง | pass: `max_total_orders: null` | ผล e2e AC-19 และ QA-2 |
| 4 | dblclick ปุ่มเปิดฟอร์ม; คลิก submit 3 ครั้งติด; Ctrl+Enter 3 ครั้งติด | pass: dialog 1 ตัว, POST 1 ครั้งต่อการเปิดฟอร์ม, key ไม่ซ้ำกัน | ผล e2e AC-19, AC-32 และ QA-4 |
| 5 | ปิดด้วย Escape และปุ่ม X | pass: focus กลับปุ่มทั้งสองทาง; หลังสร้างสำเร็จ focus ก็กลับปุ่ม | `ac19-focus-ring-after-escape.png` |
| 6 | ส่งด้วย Ctrl+Enter แล้วเปิดใหม่ | pass: ส่งได้ และเปิดใหม่ได้ฟอร์มว่าง; พิมพ์ "e" แล้วปิด/เปิดใหม่ ช่องว่างและ `badInput = false` | `qa6-ctrl-enter-reopen-empty.png` |

## Edge/negative (ช่อง Max total orders)

| ค่า | ผล |
|-----|----|
| `-5`, `1.5`, `0` | ไม่ POST; error เป็น toast ไม่ขึ้นใต้ช่อง (ข้อสังเกต 1) — `qa7-negative-value-toast.png` |
| `1e3` | ส่งเป็น 1000 ได้ 200 (browser ถือว่าเป็นตัวเลขถูกต้อง) |
| `99999999999999999999` | ส่งเป็น 1e20 backend ตอบ 400 "too big, expected at most 9007199254740991" เป็น toast และ modal ยังเปิด |
| `2147483648` | **ได้ 500** — D-1 |
| paste `abc` | Chromium ไม่รับการวาง ช่องยังว่าง ส่งแล้วถือว่าว่าง (null) |
| paste `12`, ` 7 `, `1,000` | ได้ `12`, `7`, `1000` |

## Defect

**D-1 (backend, มีอยู่ก่อน PR นี้, ไม่ block PR #374)**: จำนวนเต็มเกิน int4 ในช่องตัวเลขของแคมเปญได้ 500
1. admin `/app/group-buying` → "Create campaign"
2. กรอกครบ แล้วใส่ Max total orders = `2147483648`
3. กด Create

- Expected: 400 พร้อม error ที่เข้าใจได้ (จำกัด ≤ 2147483647)
- Actual: `POST /admin/group-buy/campaigns` ตอบ 500 `unknown_error`, toast "An unknown error occurred."; log `insert into "group_buy_campaign" ... - integer out of range`
- สาเหตุ: column `target_value`, `max_total_orders`, `max_units_per_person`, `max_people_per_group`, `team_duration_hours`, `pay_within_hours` เป็น `integer` แต่ validator ยอมถึง `Number.MAX_SAFE_INTEGER`
- ผลกระทบ: ไม่มีข้อมูลค้าง (promotion 13 แถว = campaign 13 แถว — compensation ทำงานถูก)
- เสนอ: task ฝั่ง backend validator (spec 04) — นอกขอบเขต ADM-15

## ข้อสังเกต (ไม่ใช่ defect ของ AC)
1. ค่าติดลบ ทศนิยม และ 0 ขึ้นเป็น toast ไม่ใช่ใต้ช่อง เพราะ `toCampaignBody` ไม่ระบุ field ขณะที่ "e" ขึ้นใต้ช่องแล้ว — UX ไม่สม่ำเสมอ (กฎ 19a ครอบแค่ `BAD_NUMBER_INPUT` จึงไม่ผิด spec) → backlog
2. ปิดด้วยการคลิก X ด้วยเมาส์ focus กลับปุ่มแต่ไม่มี ring (`:focus-visible` = false) — heuristic ของ browser
3. ค่าเกินขนาดที่ backend ตอบ 400 ขึ้นเป็น toast ข้อความดิบจาก validator
