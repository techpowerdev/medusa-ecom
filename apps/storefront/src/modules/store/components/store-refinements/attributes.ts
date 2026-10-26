import { PRODUCT_INDEX_NAME, priceAttribute } from "@lib/search-client"

export const OPTION_VALUES_ATTRIBUTE = "option_values"
export const CATEGORY_ATTRIBUTE = "category"
// The index calls the product's tags "labels".
export const LABELS_ATTRIBUTE = "labels"

export const getSortOptions = (currencyCode: string) => {
  const minPrice = priceAttribute("min_price", currencyCode)

  return [
    { value: PRODUCT_INDEX_NAME, label: "เกี่ยวข้องที่สุด" },
    {
      value: `${PRODUCT_INDEX_NAME}/sort/created_at:desc`,
      label: "สินค้ามาใหม่",
    },
    {
      value: `${PRODUCT_INDEX_NAME}/sort/${minPrice}:asc`,
      label: "ราคา: ต่ำ → สูง",
    },
    {
      value: `${PRODUCT_INDEX_NAME}/sort/${minPrice}:desc`,
      label: "ราคา: สูง → ต่ำ",
    },
    { value: `${PRODUCT_INDEX_NAME}/sort/title:asc`, label: "ชื่อ: ก → ฮ" },
    { value: `${PRODUCT_INDEX_NAME}/sort/title:desc`, label: "ชื่อ: ฮ → ก" },
  ]
}
