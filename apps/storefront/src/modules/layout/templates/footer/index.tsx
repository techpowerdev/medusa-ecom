import { listCategories } from "@lib/data/categories";
import { listCollections } from "@lib/data/collections";
import { STORE_CONTENT, STORE_NAME } from "@lib/store-content";
import { cn } from "@/lib/utils";

import LocalizedClientLink from "@modules/common/components/localized-client-link";

export default async function Footer() {
  const [{ collections }, productCategories] = await Promise.all([
    listCollections({ fields: "id,handle,title" }),
    listCategories({
      fields:
        "id,name,handle,parent_category_id,category_children.id,category_children.name,category_children.handle",
    }),
  ]);

  return (
    <footer className="border-t border-border w-full">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-6 xsmall:flex-row items-start justify-between py-40">
          <div className="flex flex-col gap-y-2">
            <LocalizedClientLink
              href="/"
              className="text-lg leading-5 font-medium text-muted-foreground hover:text-foreground uppercase"
              data-testid="footer-store-name"
            >
              {STORE_NAME}
            </LocalizedClientLink>
            <p className="text-sm text-muted-foreground" data-testid="footer-tagline">
              {STORE_CONTENT.footer.tagline}
            </p>
          </div>
          <div className="text-xs leading-5 font-normal gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="text-sm font-medium text-foreground">
                  หมวดหมู่
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category_id) {
                      return;
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null;

                    return (
                      <li
                        className="flex flex-col gap-2 text-muted-foreground text-sm"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={cn(
                            "hover:text-foreground",
                            children && "font-medium"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="hover:text-foreground"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="text-sm font-medium text-foreground">
                  คอลเลกชัน
                </span>
                <ul
                  className={cn(
                    "grid grid-cols-1 gap-2 text-muted-foreground text-sm",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-foreground"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span
                className="text-sm font-medium text-foreground"
                data-testid="footer-customer-service"
              >
                บริการลูกค้า
              </span>
              <ul className="grid grid-cols-1 gap-y-2 text-muted-foreground text-sm">
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/shipping"
                  >
                    ข้อมูลการจัดส่ง
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/returns"
                  >
                    นโยบายการคืนสินค้า
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/terms"
                  >
                    ข้อกำหนดการให้บริการ
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/privacy"
                  >
                    นโยบายความเป็นส่วนตัว
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/contact"
                  >
                    ติดต่อเรา
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-foreground"
                    href="/search"
                  >
                    ค้นหา
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-16 justify-between text-muted-foreground">
          <p className="text-sm leading-5" data-testid="footer-copyright">
            © {new Date().getFullYear()} {STORE_NAME} สงวนลิขสิทธิ์
          </p>
        </div>
      </div>
    </footer>
  );
}
