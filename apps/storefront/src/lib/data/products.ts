"use server"

import { sdk } from "@lib/config"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

type ProductListQueryParams = (HttpTypes.FindParams &
  HttpTypes.StoreProductListParams) & {
  options?: string[]
  option_value_id?: string | string[]
}

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: ProductListQueryParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.options,+metadata,+tags,",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * FS-14 (spec 03 กฎข้อ 19): variant id ต่อสินค้า (key = product id) สำหรับการ์ดที่มาจาก search hit (hit ไม่มี variant id)
 * `GET /store/products` ของ Medusa หนึ่ง request ต่อชุด hit ของหน้า — limit เท่าจำนวน id (default ของ Medusa คือ 20)
 * ล้มเหลว → {} (การ์ดแสดงราคาปกติ)
 */
export const listVariantIdsByProduct = async (
  productIds: string[]
): Promise<Record<string, string[]>> => {
  const ids = Array.from(new Set(productIds))
  if (!ids.length) {
    return {}
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      method: "GET",
      query: { id: ids, fields: "id,variants.id", limit: ids.length },
      next: { ...(await getCacheOptions("products")) },
      cache: "force-cache",
    })
    .then(({ products }) =>
      Object.fromEntries(
        products.map((p) => [p.id, (p.variants ?? []).map((v) => v.id)])
      )
    )
    .catch(() => ({}))
}

/**
 * CORE-14b (กฎ 26): variant ตาม id ผ่าน `GET /store/product-variants/:id` ของ Medusa
 * (กรอง sales channel + สินค้า published, ราคาของ region และ stock) — ไม่พบคืน null
 */
export const retrieveVariant = async (
  variantId: string,
  countryCode: string
): Promise<HttpTypes.StoreProductVariant | null> => {
  const region = await getRegion(countryCode)
  if (!region) {
    return null
  }

  return sdk.client
    .fetch<{ variant: HttpTypes.StoreProductVariant }>(
      `/store/product-variants/${encodeURIComponent(variantId)}`,
      {
        method: "GET",
        query: {
          region_id: region.id,
          fields:
            "id,title,manage_inventory,allow_backorder,*calculated_price,+inventory_quantity",
        },
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .then(({ variant }) => variant)
    .catch(() => null)
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  optionValueIds,
}: {
  page?: number
  queryParams?: ProductListQueryParams
  sortBy?: SortOptions
  countryCode: string
  optionValueIds?: OptionValueIds
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  const limit = queryParams?.limit || 12
  const optionFilters = Array.from(
    new Set((optionValueIds || []).filter(Boolean))
  )

  const {
    response: { products },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      ...(optionFilters.length ? { option_value_id: optionFilters } : {}),
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const filteredCount = products.length

  const nextPage = filteredCount > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count: filteredCount,
    },
    nextPage,
    queryParams,
  }
}
