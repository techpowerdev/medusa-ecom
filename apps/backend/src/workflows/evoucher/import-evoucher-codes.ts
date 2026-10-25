import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  generateEntityId,
  MedusaError,
} from "@medusajs/framework/utils"
import { adjustInventoryLevelsStep } from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"
import { parseEvoucherCsv } from "../../modules/evoucher/utils/csv"
import { assertCiphertext } from "../../modules/evoucher/utils/crypto"
import { assertEvoucherKeyStep } from "./steps/assert-evoucher-key"

export type ImportEvoucherCodesInput = {
  pool_id: string
  file_content: string
}

type CodeRow = {
  pool_id: string
  code: string
  pin: string | null
  expires_at: Date | null
  batch_ref: string
}

const CHUNK = 1000

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK)
  )

// pool → variant → inventory level เดียว (กฎข้อ 1: inventory = จำนวน code available)
export const resolveEvoucherPoolInventoryStep = createStep(
  "resolve-evoucher-pool-inventory",
  async (input: { pool_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: pools } = await query.graph({
      entity: "evoucher_pool",
      fields: ["id", "variant_id"],
      filters: { id: input.pool_id },
    })
    if (!pools[0]) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Evoucher pool ${input.pool_id} not found`
      )
    }
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "manage_inventory",
        "inventory_items.inventory_item_id",
        "inventory_items.inventory.location_levels.location_id",
      ],
      filters: { id: pools[0].variant_id },
    })
    const items = variants[0]?.inventory_items ?? []
    const levels = items[0]?.inventory?.location_levels ?? []
    if (!variants[0]?.manage_inventory || items.length !== 1 || levels.length !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Voucher variant must manage inventory with exactly one inventory item and one stock location level"
      )
    }
    return new StepResponse({
      inventory_item_id: items[0]!.inventory_item_id,
      location_id: levels[0]!.location_id,
    })
  }
)

// parse + normalize + เข้ารหัส + ตัด code ที่ซ้ำ (ในไฟล์และใน pool) — ยังไม่เขียน DB
export const prepareEvoucherCodesStep = createStep(
  "prepare-evoucher-codes",
  async (input: ImportEvoucherCodesInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const parsed = parseEvoucherCsv(input.file_content)
    const batch_ref = generateEntityId(undefined, "evbatch")

    const unique = new Map<string, CodeRow>()
    for (const row of parsed) {
      const code = await service.encryptCode(row.code)
      if (!unique.has(code)) {
        unique.set(code, {
          pool_id: input.pool_id,
          code,
          pin: row.pin ? await service.encryptPin(row.pin) : null,
          expires_at: row.expires_at ?? null,
          batch_ref,
        })
      }
    }
    for (const part of chunks([...unique.keys()])) {
      const existing = await service.listEvoucherCodes(
        { pool_id: input.pool_id, code: part },
        { select: ["code"], take: null }
      )
      existing.forEach((e) => unique.delete(e.code))
    }

    const rows = [...unique.values()]
    return new StepResponse({
      batch_ref,
      rows,
      skipped_duplicates: parsed.length - rows.length,
    })
  }
)

export const insertEvoucherCodesStep = createStep(
  "insert-evoucher-codes",
  async (input: { batch_ref: string; rows: CodeRow[] }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    input.rows.forEach((row) => {
      assertCiphertext(row.code)
      if (row.pin) {
        assertCiphertext(row.pin)
      }
    })
    for (const part of chunks(input.rows)) {
      await service.createEvoucherCodes(part)
    }
    return new StepResponse(input.rows.length, input.batch_ref)
  },
  async (batch_ref, { container }) => {
    if (!batch_ref) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.deleteEvoucherCodes({ batch_ref })
  }
)

export const importEvoucherCodesWorkflow = createWorkflow(
  "import-evoucher-codes",
  function (input: ImportEvoucherCodesInput) {
    assertEvoucherKeyStep()
    const level = resolveEvoucherPoolInventoryStep({ pool_id: input.pool_id })
    const prepared = prepareEvoucherCodesStep(input)
    const inserted = insertEvoucherCodesStep(prepared)

    when({ inserted }, ({ inserted }) => inserted > 0).then(() => {
      const adjustments = transform({ level, inserted }, ({ level, inserted }) => [
        { ...level, adjustment: inserted },
      ])
      adjustInventoryLevelsStep(adjustments)
    })

    const result = transform({ prepared, inserted }, ({ prepared, inserted }) => ({
      batch_ref: prepared.batch_ref,
      inserted,
      skipped_duplicates: prepared.skipped_duplicates,
    }))
    return new WorkflowResponse(result)
  }
)
