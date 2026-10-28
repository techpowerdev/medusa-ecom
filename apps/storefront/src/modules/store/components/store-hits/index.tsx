"use client"

import type { Hit } from "instantsearch.js"
import { useEffect, useRef, useState } from "react"
import { useHits, useInstantSearch } from "react-instantsearch"

import { listVariantIdsByProduct } from "@lib/data/products"
import useSearchSettled from "@lib/hooks/use-search-settled"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text } from "@modules/common/components/ui"
import {
  CardFlashView,
  useCardFlashPrices,
} from "@modules/products/components/flash-sale"
import Thumbnail from "@modules/products/components/thumbnail"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import SearchPagination from "./pagination"
import HitPrice, { HitPricing } from "./price"

type ProductHit = Hit<
  {
    title: string | null
    handle: string | null
    thumbnail: string | null
  } & HitPricing
>

type StoreHitsProps = {
  hitsPerPage: number
  currencyCode: string
  regionId: string
}

const StoreHits = ({ hitsPerPage, currencyCode, regionId }: StoreHitsProps) => {
  const { items } = useHits<ProductHit>()
  const flashPrices = useHitFlashPrices(
    regionId,
    items.map((hit) => hit.objectID)
  )
  // catchError: InstantSearch โยน error ของ search ออกเป็น uncaught (pageerror) เมื่อไม่มีใครรับ — ที่นี่แสดง products-error แทน
  const { status, indexUiState } = useInstantSearch({ catchError: true })
  const { isSearching, hasNoResultsYet } = useSearchSettled()

  const { page, ...refinements } = indexUiState
  const currentPage = page ?? 1
  const refinementKey = JSON.stringify(refinements)

  const settled = useRef({ page: currentPage, refinementKey })

  useEffect(() => {
    if (!isSearching) {
      settled.current = { page: currentPage, refinementKey }
    }
  }, [isSearching, currentPage, refinementKey])

  const isPagingOnly =
    refinementKey === settled.current.refinementKey &&
    currentPage !== settled.current.page

  const showSkeleton = hasNoResultsYet || (isSearching && isPagingOnly)

  // CORE-15 (กฎข้อ 29): ห้าม return ก่อน `SearchPagination` — widget ที่ unmount/mount ตาม status ทำให้ InstantSearch
  // ยิง search ใหม่ทุกครั้ง → error → loading → error วนไม่จบ; search ใหม่เกิดเฉพาะเมื่อผู้ใช้เปลี่ยน query/filter/หน้า
  return (
    <>
      {status === "error" ? (
        <Text
          className="py-16 text-center text-ui-fg-error"
          data-testid="products-error"
        >
          โหลดรายการสินค้าไม่สำเร็จ
        </Text>
      ) : showSkeleton ? (
        <SkeletonProductGrid numberOfProducts={hitsPerPage} />
      ) : !items.length ? (
        <Text
          className="py-16 text-center text-ui-fg-subtle"
          data-testid="no-products"
        >
          ไม่พบสินค้าที่ตรงกับตัวกรองนี้
        </Text>
      ) : (
        <ul
          className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
          data-testid="products-list"
        >
          {items.map((hit) =>
            hit.handle ? (
              <li key={hit.objectID}>
                <LocalizedClientLink
                  href={`/products/${hit.handle}`}
                  className="group"
                >
                  <div data-testid="product-wrapper">
                    <Thumbnail thumbnail={hit.thumbnail} size="full" />
                    {/* qa D-1 #148: ชื่อยาว/ราคา flash คู่ราคาขีดฆ่าบนจอแคบ → ราคาขึ้นบรรทัดใหม่ ไม่ล้นการ์ด */}
                    <div className="flex flex-wrap txt-compact-medium mt-4 justify-between gap-x-2">
                      <Text
                        className="text-ui-fg-subtle min-w-0 break-words"
                        data-testid="product-title"
                      >
                        {hit.title}
                      </Text>
                      <div className="flex items-center gap-x-2">
                        <CardFlashView
                          flash={flashPrices[hit.objectID]}
                          fallback={
                            <HitPrice hit={hit} currencyCode={currencyCode} />
                          }
                        />
                      </div>
                    </div>
                  </div>
                </LocalizedClientLink>
              </li>
            ) : null
          )}
        </ul>
      )}
      <SearchPagination />
    </>
  )
}

const NO_HITS: Record<string, string[]> = {}

/**
 * FS-14 (spec 03 กฎข้อ 19): hit ของ search index ไม่มี variant id → หา variant id ของการ์ดในหน้าด้วย `GET /store/products`
 * หนึ่ง request ต่อชุด hit แล้วดึงราคา flash; ระหว่างรอการ์ดแสดงราคาจาก index ตามปกติ
 */
function useHitFlashPrices(regionId: string, productIds: string[]) {
  const [variantIdsByProduct, setVariantIdsByProduct] = useState<
    Record<string, string[]>
  >({})
  const idsKey = productIds.join(",")

  useEffect(() => {
    // ไม่มี hit → ไม่ยิง server action เปล่า
    if (!idsKey) {
      return
    }
    let alive = true
    listVariantIdsByProduct(idsKey.split(",")).then(
      (byProduct) => alive && setVariantIdsByProduct(byProduct)
    )
    return () => {
      alive = false
    }
  }, [idsKey])

  return useCardFlashPrices(regionId, idsKey ? variantIdsByProduct : NO_HITS)
}

export default StoreHits
