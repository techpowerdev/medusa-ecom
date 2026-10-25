import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex"
import { FLASH_LIMIT_EXCEEDED, FLASH_SOLD_OUT } from "./errors"
import FlashSaleConfig from "./models/flash-sale-config"
import FlashSaleReservation from "./models/flash-sale-reservation"
import FlashSaleUsage from "./models/flash-sale-usage"

export type ReserveForCartInput = {
  cart_id: string
  customer_id: string
  campaigns: { campaign_id: string; units: number }[]
}

export type ReleasedReservation = { id: string; campaign_id: string; customer_id: string; units: number }

type Row = Record<string, unknown>

const limitExceeded = () =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "Flash sale limit per customer exceeded",
    FLASH_LIMIT_EXCEEDED
  )

class FlashSaleModuleService extends MedusaService({
  FlashSaleConfig,
  FlashSaleUsage,
  FlashSaleReservation,
}) {
  /**
   * FS-3: จองสิทธิ์ flash ของ cart ทุก campaign ใน transaction เดียว (spec 03 "Workflows / hooks" ข้อ 3)
   * ข้อใดล้ม → throw แล้ว rollback ทั้ง transaction; campaign ที่ไม่มี config ไม่ใช่ flash sale → ข้าม (กฎข้อ 9)
   * ผู้เรียกถือ lock ต่อ (campaign_id, customer_id); total cap atomic ด้วย conditional UPDATE เอง
   */
  @InjectManager()
  async reserveForCart(
    input: ReserveForCartInput,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<{ campaign_id: string; units: number }[]> {
    return await this.reserveForCart_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async reserveForCart_(
    input: ReserveForCartInput,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<{ campaign_id: string; units: number }[]> {
    const manager = sharedContext.transactionManager!
    const reserved: { campaign_id: string; units: number }[] = []

    for (const { campaign_id, units } of input.campaigns) {
      if (units <= 0) {
        continue
      }
      const [config] = await manager.execute<Row[]>(
        `SELECT per_customer_limit FROM flash_sale_config WHERE campaign_id = ? AND deleted_at IS NULL`,
        [campaign_id]
      )
      if (!config) {
        continue
      }
      const limit = (config.per_customer_limit as number | null) ?? null

      // (a) per-customer: usage + n <= limit แล้ว upsert (partial unique index → ON CONFLICT ต้องมี predicate)
      if (limit !== null && units > limit) {
        throw limitExceeded()
      }
      const usage = await manager.execute<Row[]>(
        `INSERT INTO flash_sale_usage (id, campaign_id, customer_id, units)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (campaign_id, customer_id) WHERE deleted_at IS NULL
         DO UPDATE SET units = flash_sale_usage.units + EXCLUDED.units, updated_at = now()
         WHERE ?::int IS NULL OR flash_sale_usage.units + EXCLUDED.units <= ?::int
         RETURNING units`,
        [generateEntityId(undefined, "fsuse"), campaign_id, input.customer_id, units, limit, limit]
      )
      if (!usage.length) {
        throw limitExceeded()
      }

      // (b) total cap: ไม่มีแถวถูกอัปเดต = ขายหมด (รวมกรณี cap ถูกลดต่ำกว่า units_sold, กฎข้อ 12)
      const sold = await manager.execute<Row[]>(
        `UPDATE flash_sale_config SET units_sold = units_sold + ?, updated_at = now()
         WHERE campaign_id = ? AND deleted_at IS NULL
           AND (total_cap IS NULL OR units_sold + ? <= total_cap)
         RETURNING id`,
        [units, campaign_id, units]
      )
      if (!sold.length) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This flash sale is sold out", FLASH_SOLD_OUT)
      }

      // (c) reservation — compensation และ FS-2 คืนค่าตาม units ที่จองจริง
      await manager.execute(
        `INSERT INTO flash_sale_reservation (id, cart_id, campaign_id, customer_id, units)
         VALUES (?, ?, ?, ?, ?)`,
        [generateEntityId(undefined, "fsres"), input.cart_id, campaign_id, input.customer_id, units]
      )
      reserved.push({ campaign_id, units })
    }

    return reserved
  }

  /**
   * FS-3 compensation: คืน usage + units_sold ตาม reservation ของ cart แล้วลบ reservation (transaction เดียว)
   * idempotent — DELETE ... RETURNING ทำให้แต่ละแถวถูกคืนครั้งเดียว; แถวที่ release แล้ว (FS-2) ไม่คืนซ้ำ
   */
  @InjectManager()
  async releaseCartReservations(
    cartId: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    await this.releaseCartReservations_(cartId, sharedContext)
  }

  @InjectTransactionManager()
  protected async releaseCartReservations_(
    cartId: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager!
    const rows = await manager.execute<Row[]>(
      `DELETE FROM flash_sale_reservation WHERE cart_id = ? AND deleted_at IS NULL
       RETURNING campaign_id, customer_id, units, released_at`,
      [cartId]
    )

    for (const row of rows.filter((r) => r.released_at === null)) {
      await this.adjustCounters_(manager, row, -1)
    }
  }

  /**
   * FS-2: คืนสิทธิ์ของ order ที่ยกเลิก/refund เต็มจำนวน (spec 03 "FS-2 คืนค่า", กฎข้อ 10) — transaction เดียว
   * idempotent ทั้ง event ซ้ำและพร้อมกัน: UPDATE ... WHERE released_at IS NULL RETURNING คืนแต่ละแถวครั้งเดียว
   * (row lock ทำให้ transaction ที่สองเห็น released_at แล้วไม่ได้แถวกลับ) คืนแถวที่ release ในครั้งนี้
   */
  @InjectManager()
  async releaseReservationsOfCart(
    cartId: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<ReleasedReservation[]> {
    return await this.releaseReservationsOfCart_(cartId, sharedContext)
  }

  @InjectTransactionManager()
  protected async releaseReservationsOfCart_(
    cartId: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<ReleasedReservation[]> {
    const manager = sharedContext.transactionManager!
    const rows = await manager.execute<ReleasedReservation[]>(
      `UPDATE flash_sale_reservation SET released_at = now(), updated_at = now()
       WHERE cart_id = ? AND released_at IS NULL AND deleted_at IS NULL
       RETURNING id, campaign_id, customer_id, units`,
      [cartId]
    )
    for (const row of rows) {
      await this.adjustCounters_(manager, row, -1)
    }
    return rows
  }

  /** compensation ของ FS-2: ยกเลิก release ของแถวที่ระบุแล้วจอง usage + units_sold กลับ (idempotent) */
  @InjectManager()
  async restoreReleasedReservations(
    ids: string[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    if (!ids.length) {
      return
    }
    await this.restoreReleasedReservations_(ids, sharedContext)
  }

  @InjectTransactionManager()
  protected async restoreReleasedReservations_(
    ids: string[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager!
    const rows = await manager.execute<ReleasedReservation[]>(
      `UPDATE flash_sale_reservation SET released_at = NULL, updated_at = now()
       WHERE id IN (${ids.map(() => "?").join(", ")}) AND released_at IS NOT NULL AND deleted_at IS NULL
       RETURNING id, campaign_id, customer_id, units`,
      ids
    )
    for (const row of rows) {
      await this.adjustCounters_(manager, row, 1)
    }
  }

  /** ปรับ usage ของลูกค้า + units_sold ของ campaign ตาม units ของ reservation (sign = +1 จอง, -1 คืน) */
  private async adjustCounters_(manager: SqlEntityManager, row: Row, sign: 1 | -1): Promise<void> {
    const delta = sign * Number(row.units)
    await manager.execute(
      `UPDATE flash_sale_usage SET units = units + ?, updated_at = now()
       WHERE campaign_id = ? AND customer_id = ? AND deleted_at IS NULL`,
      [delta, row.campaign_id, row.customer_id]
    )
    await manager.execute(
      `UPDATE flash_sale_config SET units_sold = units_sold + ?, updated_at = now()
       WHERE campaign_id = ? AND deleted_at IS NULL`,
      [delta, row.campaign_id]
    )
  }
}

export default FlashSaleModuleService
