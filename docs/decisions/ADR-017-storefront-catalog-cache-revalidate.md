# ADR-017 cache ข้อมูลแคตตาล็อกของ storefront: revalidate ตามเวลา 60 วินาที

สถานะ: **accepted** (owner 2026-10-27 — เลือกทางเลือก A revalidate 60 วินาที; เสนอโดย planner รอบ 11 ตามเงื่อนไขของ review #148 FS-14)
เกี่ยวข้อง: spec 03 (FS-14, FS-17, กฎข้อ 19, 22, AC-20, AC-24), spec 01 กฎข้อ 66f (ISR ≤ 90 วินาที), ADR-002 (Next.js starter)

## บริบท
- storefront (Medusa Next.js starter) อ่าน collection/สินค้าด้วย `fetch(..., { cache: "force-cache", next: { tags } })` โดย tag มาจาก cookie `_medusa_cache_id`
  (`getCacheOptions` ใน `lib/data/cookies.ts`)
- ตอน render หน้า static/ISR (เช่น หน้าแรก) ไม่มี cookie → ไม่มี tag และไม่มี `revalidate` → Next cache ผล fetch ไม่มีกำหนด: collection/สินค้าใหม่ไม่ขึ้นหน้าแรกจน build ใหม่
  (QA #148 ยืนยัน) และแม้มี cookie ก็ไม่มีอะไรสั่ง revalidate tag เมื่อ admin แก้แคตตาล็อก
- หน้าแรกตั้ง `export const revalidate = 60` อยู่แล้ว แต่ค่านี้**ไม่ override** fetch ที่ตั้ง `cache: "force-cache"` เอง: ใน Next 16 (ตรวจโดย reviewer #152 ที่ 16.3.8, `patch-fetch.js`)
  fetch แบบ `force-cache` ที่ไม่มี `next.revalidate` ได้ `revalidate=false` (cache ไม่มีกำหนด) — เมื่อหน้า regenerate ตาม ISR ก็ยังอ่านผล fetch เดิมจาก Data Cache จึงต้องตั้ง `revalidate`
  ที่ระดับ fetch; ระหว่าง ISR regenerate Next fetch ข้อมูลที่ stale แบบ foreground จึงเพดาน ≤ 90 วินาทีสมเหตุสมผล
- CLAUDE.md ข้อ 3: ห้ามเพิ่ม infra ใหม่ถ้า spec/ADR ไม่กำหนด

## ทางเลือก
- **A. revalidate ตามเวลา** — fetch ของ `listCollections`, `getCollectionByHandle`, `listProducts`, `listVariantIdsByProduct` ตั้ง `next.revalidate = 60` เสมอ (คง tag เมื่อมี cookie)
  ข้อดี: แก้ใน storefront 2–3 ไฟล์, ไม่มี route/secret/subscriber ใหม่, ใช้ Data Cache/ISR ของ Next ตามปกติ, สอดคล้องกับ ISR ≤ 90 วินาทีที่ยอมรับแล้วใน spec 01 กฎข้อ 66f
  ข้อเสีย: ข้อมูลใหม่ช้าได้ถึง ~60–90 วินาที; backend ได้ request เพิ่ม ≤ 1 ครั้งต่อ URL ต่อนาที (เล็กน้อย)
- **B. on-demand revalidation** — subscriber ของ backend (`product.*`, `product-collection.*`) เรียก route `POST /api/revalidate` ของ storefront พร้อม secret เพื่อ `revalidateTag`
  ข้อดี: ข้อมูลใหม่ขึ้นทันที; ข้อเสีย: route + secret ใหม่ใน storefront, subscriber ใหม่ใน backend, ต้องจัดการ retry/ความล้มเหลวของการเรียกข้ามบริการ และ tag แบบไม่ผูก cookie — เกินความจำเป็นของ v1
- **C. `cache: "no-store"`** — สดเสมอ แต่ทุกหน้าแคตตาล็อกยิง backend ทุก request (เสีย ISR/CDN ตามแผน spec 07) ไม่เหมาะกับ flash sale ที่ traffic พุ่ง
- **D. `"use cache"` + `cacheLife` ของ Next 16** — ต้องเปิด Cache Components ทั้งแอป ซึ่งเปลี่ยนโมเดล rendering/caching ของ starter ทั้งหมด (กระทบทุก data function และหน้าที่อ่าน cookie)
  — ใหญ่เกินกว่าปัญหานี้ ตัดทิ้งใน v1

## การตัดสินใจ (owner 2026-10-27)
**A** — ส่งมอบใน FS-17; ถ้าภายหลังต้องการข้อมูลทันที (เช่น เปิด flash sale แล้วสินค้าต้องขึ้นภายในวินาที) จึงพิจารณา B ใน ADR ใหม่

## ผลที่ตามมา
- หน้าแรก, `/store`, `/search`, collection แสดงข้อมูลใหม่ภายใน ≤ 90 วินาที โดยไม่ build ใหม่ (spec 03 AC-24)
- ราคา/ส่วนลดที่ใช้จริงยังมาจาก cart (ไม่ได้รับผลจาก cache นี้); ข้อมูล flash (`/store/flash-sales/active`) ไม่อยู่ในขอบเขต ADR นี้
- `listRegions` และ data function อื่นที่ยัง `force-cache` แบบไม่มี `revalidate` ไม่ถูกแก้ใน FS-17 — ถ้าพบปัญหาเดียวกันให้ใช้หลักเดียวกันใน task ของ spec นั้น
