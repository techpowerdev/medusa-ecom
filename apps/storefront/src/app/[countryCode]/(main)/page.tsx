import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import HomeCampaigns from "@modules/home/components/campaigns"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { listActiveFlashCampaigns } from "@lib/data/flash-sales"
import { listActiveGroupBuyCampaigns } from "@lib/data/group-buy"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions, listRegionsUncached } from "@lib/data/regions"
import { toJsonLd } from "@lib/util/product-structured-data"
import { hreflangAlternates } from "@lib/util/hreflang"
import { STORE_CONTENT, STORE_NAME } from "@lib/store-content"
import { getSiteOrigin, listCountryCodes } from "@lib/util/site"
import { buildRegionsReturnPolicies } from "@lib/util/store-policies"

export const dynamic = "force-static"
export const revalidate = 60

export async function generateMetadata(props: {
  params: Promise<{ countryCode: string }>
}): Promise<Metadata> {
  const { countryCode } = await props.params
  const [origin, regions] = await Promise.all([getSiteOrigin(), listRegions()])

  return {
    title: `${STORE_NAME} | ร้านค้าออนไลน์`,
    description: STORE_CONTENT.description,
    alternates: {
      canonical: `${origin}/${countryCode}`,
      languages: {
        ...hreflangAlternates(origin, listCountryCodes(regions)),
        "x-default": origin,
      },
    },
  }
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  // GB-7c (spec 04 กฎข้อ 29a): แคมเปญ flash + group buy ที่ active — สินค้าเดียวของทุกแคมเปญ group buy ใน request เดียว
  const [flashSales, groupCampaigns] = await Promise.all([
    listActiveFlashCampaigns(),
    listActiveGroupBuyCampaigns(),
  ])
  const productIds = Array.from(
    new Set(groupCampaigns.flatMap((c) => (c.product_id ? [c.product_id] : [])))
  )
  const campaignProducts = productIds.length
    ? await listProducts({
        regionId: region.id,
        queryParams: { id: productIds, limit: productIds.length },
      })
        .then(({ response }) => response.products)
        .catch(() => [])
    : []

  const origin = await getSiteOrigin()
  const homeUrl = `${origin}/${countryCode}`
  // CORE-20c (กฎข้อ 60): policy ใน structured data อ่าน region แบบไม่ cache
  const returnPolicies = buildRegionsReturnPolicies(await listRegionsUncached())
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: STORE_NAME,
      url: origin,
      ...(returnPolicies.length
        ? { hasMerchantReturnPolicy: returnPolicies }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: STORE_NAME,
      url: homeUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${homeUrl}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
      />
      <Hero />
      <HomeCampaigns
        flashSales={flashSales}
        groupCampaigns={groupCampaigns}
        products={campaignProducts}
        countryCode={countryCode}
        // เวลาที่ render (หน้า static/ISR) ใช้เริ่มนับถอยหลัง — client เดินต่อจากเวลาจริง
        // eslint-disable-next-line react-hooks/purity
        now={Date.now()}
      />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
