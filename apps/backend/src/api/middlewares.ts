import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { affiliatePortalMiddlewares } from './affiliate/middlewares'
import { adminAffiliateMiddlewares } from './admin/affiliate/middlewares'
import { adminEvoucherMiddlewares } from './admin/evoucher/middlewares'
import { adminFlashSaleMiddlewares } from './admin/flash-sales/middlewares'
import { adminGroupBuyMiddlewares } from './admin/group-buy/middlewares'
import { storeEvoucherMiddlewares } from './store/evouchers/middlewares'
import { storeFlashSaleMiddlewares } from './store/flash-sales/middlewares'
import { storeGroupBuyMiddlewares } from './store/group-buy/middlewares'
import { businessErrorHandler } from './error-handler'
import { storeOwnershipMiddlewares } from './store/ownership/middlewares'
import { guardPaidStripeSession } from './store/payment-collections/stripe-session-guard'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  errorHandler: businessErrorHandler, // PROMO-2 (spec 03 กฎข้อ 13)
  routes: [
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    // Affiliate portal: separate `affiliate` actor type (spec 05, AC-12, AC-18, กฎ 18, Q6)
    ...affiliatePortalMiddlewares,
    ...adminEvoucherMiddlewares,
    // EV-7a (spec 02 กฎข้อ 22, 23): รายการ code ของลูกค้า + field ของ pool/partner บน GET /store/products*
    ...storeEvoucherMiddlewares,
    ...adminFlashSaleMiddlewares,
    ...storeFlashSaleMiddlewares,
    ...adminAffiliateMiddlewares,
    ...adminGroupBuyMiddlewares,
    ...storeGroupBuyMiddlewares,
    // CORE-6 (spec 01 "ไม่มี guest"): cart + checkout ต้องมี customer ที่ล็อกอิน (AC-6)
    {
      matcher: '/store/carts*',
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
    {
      matcher: '/store/payment-collections*',
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
    // CORE-12 (ADR-013): cart/payment collection/shipping options/order ต้องเป็นของ customer ที่ล็อกอิน
    ...storeOwnershipMiddlewares,
    // PAY-6 (spec 06 กฎข้อ 7A, ADR-015): ระบุ method จึงรันหลัง auth + ownership ที่ไม่ระบุ method (ADR-013, AC-13g)
    {
      method: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [guardPaidStripeSession],
    },
  ],
})
