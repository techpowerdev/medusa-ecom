import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
  validateAndTransformBody,
} from '@medusajs/framework/http'
import { PostAffiliateRegisterSchema } from './affiliate/validators'
import { adminAffiliateMiddlewares } from './admin/affiliate/middlewares'
import { adminEvoucherMiddlewares } from './admin/evoucher/middlewares'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
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
    // Affiliate portal: separate `affiliate` actor type (spec 05, AC-12)
    {
      method: ['POST'],
      matcher: '/affiliate/register',
      middlewares: [
        authenticate('affiliate', ['session', 'bearer'], { allowUnregistered: true }),
        validateAndTransformBody(PostAffiliateRegisterSchema),
      ],
    },
    {
      matcher: '/affiliate/me*',
      middlewares: [authenticate('affiliate', ['session', 'bearer'])],
    },
    ...adminEvoucherMiddlewares,
    ...adminAffiliateMiddlewares,
  ],
})
