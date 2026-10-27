"use client"

import type { Hit } from "instantsearch.js"
import { useEffect, useRef, useState } from "react"
import { useHits, useInstantSearch } from "react-instantsearch"

import { listVariantIdsByProduct } from "@lib/data/products"
import useSearchSettled from "@lib/hooks/use-search-settled"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text } from "@modules/common/components/ui"
import {
  FlashPrice,
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
  const { status, indexUiState } = useInstantSearch()
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

  if (status === "error") {
    return (
      <Text
        className="py-16 text-center text-ui-fg-error"
        data-testid="products-error"
      >
        โหลดรายการสินค้าไม่สำเร็จ
      </Text>
    )
  }

  return (
    <>
      {showSkeleton ? (
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
                    <div className="flex txt-compact-medium mt-4 justify-between">
                      <Text
                        className="text-ui-fg-subtle"
                        data-testid="product-title"
                      >
                        {hit.title}
                      </Text>
                      {flashPrices[hit.objectID] ? (
                        <FlashPrice price={flashPrices[hit.objectID]} />
                      ) : (
                        <HitPrice hit={hit} currencyCode={currencyCode} />
                      )}
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
    let alive = true
    listVariantIdsByProduct(idsKey ? idsKey.split(",") : []).then(
      (byProduct) => alive && setVariantIdsByProduct(byProduct)
    )
    return () => {
      alive = false
    }
  }, [idsKey])

  return useCardFlashPrices(regionId, variantIdsByProduct)
}

export default StoreHits
