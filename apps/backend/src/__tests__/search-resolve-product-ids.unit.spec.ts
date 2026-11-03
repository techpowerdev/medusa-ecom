import type { SearchTypes } from "@medusajs/framework/types";

import { resolveProductIds } from "../search/helpers/resolve-product-ids";

// CORE-9b (spec 01 กฎข้อ 79, AC-108): event ลบที่ payload ไม่มี relation ต้องไม่ throw
// (อยู่นอก src/search เพราะ Medusa โหลดทุกไฟล์ใน src/search เป็น search index ตอนบูต)
function contextWith(rows: unknown[]) {
  const graph = jest.fn().mockResolvedValue({ data: rows });
  const context = {
    container: { query: { graph } },
  } as unknown as SearchTypes.SearchIngestionContext;
  return { graph, context };
}

describe("resolveProductIds", () => {
  it("product-option.deleted ที่ query คืน row ว่าง/ไม่มี relation → คืน [] ไม่ throw", async () => {
    const { context } = contextWith([undefined, { id: "opt_1" }, { id: "opt_2", products: [] }]);

    await expect(
      resolveProductIds({ name: "product-option.deleted", data: { id: "opt_1" } }, context),
    ).resolves.toEqual([]);
  });

  it("product-option.* หา product ผ่าน relation products (option ผูกได้หลายสินค้า) และอ่าน row ที่ถูกลบ", async () => {
    const { graph, context } = contextWith([
      { id: "opt_1", products: [{ id: "prod_1" }, null, { id: "prod_2" }] },
    ]);

    await expect(
      resolveProductIds({ name: "product-option.deleted", data: [{ id: "opt_1" }] }, context),
    ).resolves.toEqual(["prod_1", "prod_2"]);
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_option",
        fields: ["products.id"],
        filters: { id: ["opt_1"] },
        withDeleted: true,
      }),
    );
  });

  it("product-option-value.deleted ที่ไม่มี option → คืน [] ไม่ throw; มี option → product ของ option", async () => {
    const { graph, context } = contextWith([
      undefined,
      { id: "optval_1" },
      { id: "optval_2", option: { products: [{ id: "prod_3" }] } },
    ]);

    await expect(
      resolveProductIds(
        { name: "product-option-value.deleted", data: [{ id: "optval_1" }, { id: "optval_2" }] },
        context,
      ),
    ).resolves.toEqual(["prod_3"]);
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_option_value",
        fields: ["option.products.id"],
      }),
    );
  });
});
