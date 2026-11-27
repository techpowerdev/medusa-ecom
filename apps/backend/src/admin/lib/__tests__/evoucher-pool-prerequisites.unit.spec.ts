import {
  evoucherPoolPrerequisites,
  type PrerequisiteProduct,
  type PrerequisiteVariant,
} from "../evoucher-pool-prerequisites"

// EV-27 (spec 02 กฎข้อ 43b, AC-57): เงื่อนไขก่อนสร้าง voucher pool จากข้อมูล GET /admin/products/:id
const PRODUCT_ID = "prod_1"
const VARIANT_ID = "variant_1"
const ITEM_ID = "iitem_1"

const readyVariant = (over: Partial<PrerequisiteVariant> = {}): PrerequisiteVariant => ({
  id: VARIANT_ID,
  manage_inventory: true,
  inventory_items: [
    {
      inventory_item_id: ITEM_ID,
      required_quantity: 1,
      inventory: { variants: [{ id: VARIANT_ID }], location_levels: [{ location_id: "sloc_1" }] },
    },
  ],
  ...over,
})

const product = (variant: PrerequisiteVariant, over: Partial<PrerequisiteProduct> = {}): PrerequisiteProduct => ({
  id: PRODUCT_ID,
  shipping_profile: null,
  variants: [{ id: "variant_other", manage_inventory: false, inventory_items: [] }, variant],
  ...over,
})

const codes = (p: PrerequisiteProduct) => evoucherPoolPrerequisites(p, VARIANT_ID)?.map((i) => i.code)

const levels = (n: number) => Array.from({ length: n }, (_, i) => ({ location_id: `sloc_${i}` }))

describe("evoucherPoolPrerequisites", () => {
  it("returns [] for a ready variant", () => {
    expect(evoucherPoolPrerequisites(product(readyVariant()), VARIANT_ID)).toEqual([])
  })

  it("treats a missing shipping_profile field as passing", () => {
    const { shipping_profile: _omit, ...rest } = product(readyVariant())
    expect(evoucherPoolPrerequisites(rest, VARIANT_ID)).toEqual([])
  })

  it("flags manageInventory and inventoryItem (not stockLocation) when inventory is off with no item", () => {
    expect(codes(product(readyVariant({ manage_inventory: false, inventory_items: [] })))).toEqual([
      "manageInventory",
      "inventoryItem",
    ])
  })

  it("flags inventoryItem when there are two items", () => {
    const [item] = readyVariant().inventory_items!
    expect(
      codes(product(readyVariant({ inventory_items: [item!, { ...item!, inventory_item_id: "iitem_2" }] })))
    ).toEqual(["inventoryItem"])
  })

  it("flags inventoryItem when required_quantity is 2", () => {
    const [item] = readyVariant().inventory_items!
    expect(codes(product(readyVariant({ inventory_items: [{ ...item!, required_quantity: 2 }] })))).toEqual([
      "inventoryItem",
    ])
  })

  it("flags inventoryItem when another variant shares the item", () => {
    const [item] = readyVariant().inventory_items!
    const shared = {
      ...item!,
      inventory: { ...item!.inventory, variants: [{ id: VARIANT_ID }, { id: "variant_other" }] },
    }
    expect(codes(product(readyVariant({ inventory_items: [shared] })))).toEqual(["inventoryItem"])
  })

  it("flags shippingProfile when the product has one", () => {
    expect(codes(product(readyVariant(), { shipping_profile: { id: "sp_1" } }))).toEqual(["shippingProfile"])
  })

  it.each([0, 2])("flags stockLocation when the item has %i location levels", (n) => {
    const [item] = readyVariant().inventory_items!
    const variant = readyVariant({
      inventory_items: [{ ...item!, inventory: { ...item!.inventory, location_levels: levels(n) } }],
    })
    expect(codes(product(variant))).toEqual(["stockLocation"])
  })

  it("orders every failure as manageInventory, inventoryItem, shippingProfile", () => {
    expect(
      codes(product(readyVariant({ manage_inventory: false, inventory_items: [] }), { shipping_profile: { id: "sp_1" } }))
    ).toEqual(["manageInventory", "inventoryItem", "shippingProfile"])
  })

  it("links each code to the Medusa page that fixes it", () => {
    const failing = readyVariant({ manage_inventory: false, inventory_items: [] })
    expect(evoucherPoolPrerequisites(product(failing, { shipping_profile: { id: "sp_1" } }), VARIANT_ID)).toEqual([
      { code: "manageInventory", to: `/products/${PRODUCT_ID}/variants/${VARIANT_ID}/edit` },
      { code: "inventoryItem", to: `/products/${PRODUCT_ID}/variants/${VARIANT_ID}/manage-items` },
      { code: "shippingProfile", to: `/products/${PRODUCT_ID}/shipping-profile` },
    ])
    const [item] = readyVariant().inventory_items!
    const noLocation = readyVariant({
      inventory_items: [{ ...item!, inventory: { ...item!.inventory, location_levels: [] } }],
    })
    expect(evoucherPoolPrerequisites(product(noLocation), VARIANT_ID)).toEqual([
      { code: "stockLocation", to: `/inventory/${ITEM_ID}/locations` },
    ])
  })

  it("returns null when the variant is not on the product", () => {
    expect(evoucherPoolPrerequisites(product(readyVariant()), "variant_missing")).toBeNull()
  })
})
