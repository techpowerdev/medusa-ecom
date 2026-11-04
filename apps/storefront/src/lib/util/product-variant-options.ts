import { HttpTypes } from "@medusajs/types"
import { isEqual } from "lodash"

// GB-7a2 (spec 04 กฎข้อ 31a): หา variant จาก option ที่เลือก — ใช้ร่วมระหว่าง PDP และหน้ากลุ่ม

export const optionsAsKeymap = (variantOptions: HttpTypes.StoreProductVariant["options"]) =>
  variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})

/** variant ที่ option ตรงกับที่เลือกครบทุกตัว; ไม่ครบ/ไม่มี → undefined */
export const findVariantByOptions = (
  variants: HttpTypes.StoreProductVariant[] | null | undefined,
  options: Record<string, string | undefined>
) => variants?.find((v) => isEqual(optionsAsKeymap(v.options), options))
