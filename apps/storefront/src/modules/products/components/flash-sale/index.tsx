"use client"

import { getActiveFlashSales } from "@lib/data/flash-sales"
import {
  type ActiveFlashSales,
  type CardFlash,
  type FlashOffer,
  type FlashVariantPrice,
  cardFlashPrices,
  countdownLabel,
  flashOfferForVariant,
} from "@lib/util/flash-sale"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"

type FlashOfferState = { offer: FlashOffer | null; now: number }

/**
 * FS-6/FS-13: offer flash ของ variant ที่เลือกบน PDP — PDP เป็น static (revalidate 60) จึงดึงข้อมูลฝั่ง client ทุกครั้งที่เปิดหน้า
 * ใช้ร่วมกันระหว่างกล่อง flash, ปุ่มเพิ่มลง cart (disable เมื่อ sold_out, กฎข้อ 18) และแถบล่างบนมือถือ
 * FS-16 (กฎข้อ 21a): `loading` = request flash ของชุด variant ปัจจุบันยังไม่ตอบ (สำเร็จหรือ error) — HTML ฝั่ง server
 * (ฟอร์ม no-JS) ไม่อยู่ในสถานะรอ จึงนับเฉพาะหลัง hydrate
 */
export function useFlashOffer(
  product: HttpTypes.StoreProduct,
  region: HttpTypes.StoreRegion,
  variant?: HttpTypes.StoreProductVariant
): FlashOfferState & { loading: boolean } {
  const [data, setData] = useState<ActiveFlashSales | null>(null)
  const [answeredKey, setAnsweredKey] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const hydrated = useSyncExternalStore(noopSubscribe, isClient, isServer)
  const key = `${region.id}:${(product.variants ?? []).map((v) => v.id)}`

  useEffect(() => {
    let alive = true
    const ids = (product.variants ?? []).map((v) => v.id)
    // server action ล้ม (เช่น 500) → reject: ถือว่าไม่มีข้อมูล flash แล้วปลดสถานะรอ ไม่ค้างปุ่ม
    getActiveFlashSales(region.id, ids)
      .catch(() => null)
      .then((res) => {
        if (alive) {
          setData(res)
          setAnsweredKey(key)
        }
      })
    return () => {
      alive = false
    }
  }, [product.variants, region.id, key])

  const offer = flashOfferForVariant(data, variant?.id, now)
  const ticking = !!offer

  // เดินนาฬิกาเฉพาะตอนมี offer; เลย ends_at → offer เป็น null แล้วหยุดเอง (ไม่ต้องโหลดหน้าใหม่)
  useEffect(() => {
    if (!ticking) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])

  return { offer, now, loading: hydrated && answeredKey !== key }
}

const noopSubscribe = () => () => {}
const isClient = () => true
const isServer = () => false

/**
 * FS-14 (กฎข้อ 19): ราคา flash ของการ์ดที่ดึงฝั่ง client (หน้าแรกเป็น static, `/store` มาจาก search hit) — no-store ตามกฎข้อ 4
 * ยังไม่ได้ข้อมูลหรือ request ล้ม → {} (การ์ดแสดงราคาปกติ ไม่ค้าง skeleton)
 */
export function useCardFlashPrices(
  regionId: string,
  variantIdsByProduct: Record<string, string[]>
): Record<string, CardFlash> {
  const [prices, setPrices] = useState<Record<string, CardFlash>>({})
  const key = JSON.stringify(variantIdsByProduct)

  useEffect(() => {
    const byProduct: Record<string, string[]> = JSON.parse(key)
    if (!Object.keys(byProduct).length) {
      return
    }
    let alive = true
    getActiveFlashSales(regionId, Object.values(byProduct).flat()).then(
      (res) => alive && setPrices(cardFlashPrices(res, byProduct, Date.now()))
    )
    return () => {
      alive = false
    }
  }, [regionId, key])

  // ไม่มีสินค้า → ไม่ยิง server action เปล่า และไม่คืนราคาของชุดก่อนหน้า
  return key === "{}" ? NO_PRICES : prices
}

const NO_PRICES: Record<string, CardFlash> = {}

const CardFlashPricesContext = createContext<Record<string, CardFlash>>({})

/** FS-14: ดึงราคา flash ครั้งเดียวต่อรายการการ์ด (rail หน้าแรก) ให้ `CardFlashPrice` ของแต่ละการ์ดอ่าน */
export function CardFlashPricesProvider({
  regionId,
  variantIdsByProduct,
  children,
}: {
  regionId: string
  variantIdsByProduct: Record<string, string[]>
  children: ReactNode
}) {
  const prices = useCardFlashPrices(regionId, variantIdsByProduct)
  return (
    <CardFlashPricesContext.Provider value={prices}>
      {children}
    </CardFlashPricesContext.Provider>
  )
}

/** FS-14: ราคา flash ของการ์ดจาก `CardFlashPricesProvider`; ไม่มีราคา flash → `fallback` (ราคาปกติ) */
export function CardFlashPrice({
  productId,
  fallback,
}: {
  productId: string
  fallback: ReactNode
}) {
  const flash = useContext(CardFlashPricesContext)[productId]
  return <CardFlashView flash={flash} fallback={fallback} />
}

/**
 * ราคาบนการ์ด: ราคา flash, หรือป้าย sold out + ราคาปกติ (FS-16 กฎข้อ 21c), หรือราคาปกติ (`fallback`) เมื่อไม่อยู่ในแคมเปญ/ยังไม่ได้ข้อมูล
 */
export function CardFlashView({
  flash,
  fallback,
}: {
  flash?: CardFlash | null
  fallback: ReactNode
}) {
  if (!flash) {
    return <>{fallback}</>
  }
  if ("sold_out" in flash) {
    return (
      <>
        <span
          className="rounded-rounded bg-ui-bg-subtle px-2 py-0.5 text-small-regular text-ui-fg-error"
          data-testid="flash-card-sold-out"
        >
          แฟลชเซลหมดแล้ว
        </span>
        {fallback}
      </>
    )
  }
  return <FlashPrice price={flash} />
}

/** ราคา flash + ราคาขีดฆ่า (test id เดียวกันทั้งกล่องบน PDP, แถบล่างบนมือถือ และการ์ด PLP — AC-19) */
export function FlashPrice({
  price,
  className,
}: {
  price: FlashVariantPrice
  className?: string
}) {
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: price.currency_code })
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span
        className={className ?? "text-ui-fg-interactive"}
        data-testid="flash-price"
      >
        {money(price.flash_price!)}
      </span>
      <span
        className="line-through text-ui-fg-subtle"
        data-testid="flash-original-price"
      >
        {money(price.original_price)}
      </span>
    </span>
  )
}

/**
 * FS-6 (spec 03, AC-4, AC-13 e, กฎข้อ 4): banner แคมเปญ + countdown "สิ้นสุดใน" + ราคา flash/ราคาขีดฆ่า
 * + "สินค้าหมด"/"เหลือ N ชิ้น" บน PDP — ข้อมูลจาก `useFlashOffer`
 * ราคามาจาก Promotion module ของ Medusa (FS-4) ยอดจริงคือยอดใน cart (กฎข้อ 14)
 */
export default function FlashSale({ offer, now }: FlashOfferState) {
  if (!offer) {
    return null
  }

  const { sale, price } = offer
  const countdown = sale.show_countdown
    ? countdownLabel(sale.ends_at, now)
    : null
  return (
    <div
      className="flex flex-col gap-y-2 rounded-rounded border border-ui-fg-interactive p-3"
      data-testid="flash-sale"
    >
      <p
        className="text-base-semi text-ui-fg-interactive"
        data-testid="flash-banner"
      >
        {sale.banner_text || "แฟลชเซล ราคาพิเศษช่วงเวลาจำกัด"}
      </p>
      {countdown && (
        <p className="text-small-regular" data-testid="flash-countdown">
          สิ้นสุดใน <span className="tabular-nums">{countdown}</span>
        </p>
      )}
      {sale.sold_out ? (
        <p
          className="text-base-semi text-ui-fg-error"
          data-testid="flash-sold-out"
        >
          สินค้าหมด
        </p>
      ) : (
        <>
          <p>
            <FlashPrice
              price={price}
              className="text-xl-semi text-ui-fg-interactive"
            />
          </p>
          {sale.remaining_units != null && (
            <p className="text-small-regular" data-testid="flash-remaining">
              เหลือ {sale.remaining_units} ชิ้น
            </p>
          )}
        </>
      )}
    </div>
  )
}
