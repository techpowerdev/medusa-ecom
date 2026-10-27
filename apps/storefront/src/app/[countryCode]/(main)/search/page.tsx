import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCardFlashPrices } from "@lib/data/flash-card-prices"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import SearchForm from "@modules/search/components/search-form"

const RESULT_LIMIT = 24

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string | string[] }>
}

const getQuery = (q?: string | string[]) =>
  (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 200) ?? ""

export async function generateMetadata(props: Props): Promise<Metadata> {
  const query = getQuery((await props.searchParams).q)
  return {
    title: query ? `ผลการค้นหา "${query}"` : "ค้นหาสินค้า",
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage(props: Props) {
  const { countryCode } = await props.params
  const query = getQuery((await props.searchParams).q)

  const region = await getRegion(countryCode)
  if (!region) {
    notFound()
  }

  const { response } = query
    ? await listProducts({
        countryCode,
        queryParams: { q: query, limit: RESULT_LIMIT },
      })
    : { response: { products: [], count: 0 } }

  // FS-14 (spec 03 กฎข้อ 19): หน้านี้ dynamic และผลมาจาก `GET /store/products` (มี variant id อยู่แล้ว) → ราคา flash ฝั่ง server แบบ PLP
  const flashPrices = await getCardFlashPrices(region.id, response.products)

  return (
    <div className="content-container py-6" data-testid="search-container">
      <h1 className="text-2xl-semi mb-6" data-testid="search-page-title">
        {query ? `ผลการค้นหา "${query}"` : "ค้นหาสินค้า"}
      </h1>
      <SearchForm
        countryCode={countryCode}
        defaultValue={query}
        className="mb-8 max-w-xl"
      />
      {query && (
        <p
          className="text-small-regular text-ui-fg-subtle mb-6"
          data-testid="search-result-count"
        >
          พบสินค้า {response.count} รายการ
        </p>
      )}
      {query && response.products.length === 0 ? (
        <p className="text-ui-fg-subtle" data-testid="search-no-results">
          ไม่พบสินค้าที่ตรงกับคำค้นหา ลองใช้คำอื่น
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
          data-testid="search-results"
        >
          {response.products.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                flashPrice={flashPrices[product.id]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
