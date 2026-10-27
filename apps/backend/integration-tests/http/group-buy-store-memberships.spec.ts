import path from "path";
import {
  medusaIntegrationTestRunner,
  TestEventUtils,
} from "@medusajs/test-utils";
import {
  ContainerRegistrationKeys,
  MathBN,
  Modules,
} from "@medusajs/framework/utils";
import {
  convertDraftOrderWorkflow,
  createCartWorkflow,
} from "@medusajs/medusa/core-flows";
import seedThailand from "../../src/scripts/seed";
import { getPublishableKey } from "../../src/scripts/print-publishable-key";
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign";
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status";
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group";
import { joinGroupWorkflow } from "../../src/workflows/group-buy/join-group";
import { leaveGroupWorkflow } from "../../src/workflows/group-buy/leave-group";
import { succeedGroupWorkflow } from "../../src/workflows/group-buy/group-outcome";
import { registerCustomer, storeHeadersFor } from "../helpers/customer";

jest.setTimeout(240 * 1000);

const HOUR = 60 * 60 * 1000;

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบเดียวกับ payment-session-guard.spec.ts) — mock เฉพาะ network
const stripeSdkPath = require.resolve("stripe", {
  paths: [
    path.dirname(
      require.resolve("@medusajs/payment-stripe/package.json", {
        paths: [require.resolve("@medusajs/medusa/package.json")],
      }),
    ),
  ],
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require(stripeSdkPath);

type Res = { status: number; data: any; headers: Record<string, string> };

// error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้ จึงคืนเฉพาะ status/data/headers
const settle = (request: Promise<any>): Promise<Res> =>
  request.then(
    (r) => ({ status: r.status, data: r.data, headers: r.headers }),
    (e) => {
      if (!e?.response) {
        throw new Error(`request failed without response: ${e?.message}`);
      }
      return {
        status: e.response.status,
        data: e.response.data,
        headers: e.response.headers,
      };
    },
  );

type Member = { id: string; order_id: string };

// GB-8 (spec 04 API รอบ 10, กฎข้อ 21, ADR-016): store route อ่านอย่างเดียวของ membership + draft order ของผู้เรียก
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string;
    let a: { headers: Record<string, string> };
    let b: { headers: Record<string, string> };
    let aId: string;
    let groupId: string;
    let m1: Member;
    let m2: Member;
    let m3: Member;

    beforeAll(async () => {
      const container = getContainer();
      await seedThailand({ container, args: [] });
      pk = await getPublishableKey(container);
      const ra = await registerCustomer(
        api,
        pk,
        "gb8-a@example.com",
        "gb8-password-a",
      );
      const rb = await registerCustomer(
        api,
        pk,
        "gb8-b@example.com",
        "gb8-password-b",
      );
      a = storeHeadersFor(pk, ra.token);
      b = storeHeadersFor(pk, rb.token);
      aId = ra.customerId;

      const query = container.resolve(ContainerRegistrationKeys.QUERY);
      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id"],
      });
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { handle: "t-shirt" },
      });
      const product = products[0];

      const { result: campaign } = await createGroupBuyCampaignWorkflow(
        container,
      ).run({
        input: {
          name: "GB-8 my memberships",
          target_type: "orders",
          target_value: 5,
          group_mode: "pool",
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 10,
            target_rules: [
              {
                attribute: "items.product.id",
                operator: "in",
                values: [product.id],
              },
            ],
          },
          rules: [
            { attribute: "currency_code", operator: "in", values: ["thb"] },
          ],
        } as CreateGroupBuyCampaignInput,
      });
      await setGroupBuyCampaignStatusWorkflow(container).run({
        input: { id: campaign.id, status: "active" },
      });
      const { result: group } = await createGroupWorkflow(container).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      });
      groupId = group.id;

      const join = async (customerId: string): Promise<Member> => {
        const { result: cart } = await createCartWorkflow(container).run({
          input: {
            region_id: regions[0].id,
            customer_id: customerId,
            items: [{ variant_id: product.variants[0].id, quantity: 1 }],
          },
        });
        const { result } = await joinGroupWorkflow(container).run({
          input: {
            join_token: group.join_token,
            cart_id: cart.id,
            customer_id: customerId,
          },
        });
        return { id: result.id, order_id: result.order_id };
      };

      m1 = await join(aId);
      m2 = await join(aId);
      m3 = await join(rb.customerId);
      // รอ subscriber ของ order.canceled ให้จบก่อน snapshot ของ test runner (แบบเดียวกับ group-buy-memberships.spec.ts)
      const canceled = TestEventUtils.waitSubscribersExecution(
        "order.canceled",
        container.resolve(Modules.EVENT_BUS),
      );
      await leaveGroupWorkflow(container).run({
        input: { membership_id: m2.id, customer_id: aId },
      });
      await canceled;
    });

    const get = (p: string, headers: { headers: Record<string, string> } = a) =>
      settle(api.get(p, headers));
    const LIST = "/store/customers/me/group-buy/memberships";
    const one = (orderId: string) =>
      `/store/customers/me/group-buy/orders/${orderId}`;

    // BigNumber ที่ Query ของ app คืนเป็นคนละ class กับ MathBN ใน registry ของ jest (instanceof ไม่ผ่าน) → แปลงผ่าน toJSON ก่อนเทียบ
    const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
    async function dbOrder(orderId: string) {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "id",
            "total",
            "is_draft_order",
            "payment_collections.id",
            "payment_collections.amount",
          ],
          filters: { id: orderId },
        });
      return data[0] as any;
    }

    describe("GET /store/customers/me/group-buy/memberships", () => {
      it("AC-38: lists only the caller's memberships (joined + cancelled), newest first", async () => {
        const res = await get(LIST);
        expect(res.status).toEqual(200);
        expect(res.data.count).toEqual(2);
        expect(res.data.memberships.map((m: any) => m.id)).toEqual([
          m2.id,
          m1.id,
        ]);
        expect(JSON.stringify(res.data)).not.toContain(m3.id);

        const byId = Object.fromEntries(
          res.data.memberships.map((m: any) => [m.id, m]),
        );
        expect(byId[m1.id].status).toEqual("joined");
        expect(byId[m2.id].status).toEqual("cancelled");
        for (const m of [m1, m2]) {
          const row = byId[m.id];
          expect(row).toEqual(
            expect.objectContaining({
              units: 1,
              order_id: m.order_id,
              joined_at: expect.any(String),
              group: expect.objectContaining({
                id: groupId,
                status: "open",
                pay_deadline_at: null,
              }),
              campaign: expect.objectContaining({
                name: "GB-8 my memberships",
              }),
            }),
          );
          expect(row.group).toHaveProperty("ends_at");
          expect(row.group).toHaveProperty("join_token");
          expect(row.order).toEqual(
            expect.objectContaining({
              id: m.order_id,
              is_draft_order: true,
              currency_code: "thb",
            }),
          );
          expect(row.order).toHaveProperty("display_id");
          expect(row.order).toHaveProperty("status");
          const db = await dbOrder(m.order_id);
          expect(MathBN.eq(row.order.total, plain(db.total))).toBe(true);
        }
      });

      it("AC-38: limit=1&offset=1 → 1 membership, count=2", async () => {
        const res = await get(`${LIST}?limit=1&offset=1`);
        expect(res.status).toEqual(200);
        expect(res.data.memberships).toHaveLength(1);
        expect(res.data.memberships[0].id).toEqual(m1.id);
        expect(res.data.count).toEqual(2);
      });

      it.each(["limit=101", "limit=0", "offset=-1"])(
        "AC-38: %s → 400",
        async (qs) => {
          const res = await get(`${LIST}?${qs}`);
          expect(res.status).toEqual(400);
          expect(res.data.type).toEqual("invalid_data");
        },
      );

      it("AC-38: no token → 401", async () => {
        const res = await get(LIST, storeHeadersFor(pk));
        expect(res.status).toEqual(401);
      });
    });

    describe("GET /store/customers/me/group-buy/orders/:order_id", () => {
      // test runner restore DB กลับเป็น snapshot ก่อนทุก test → ทำกลุ่มให้สำเร็จ (GB-4 สร้าง payment collection) ใน test เอง
      const succeed = async (): Promise<string> => {
        await succeedGroupWorkflow(getContainer()).run({
          input: { group_id: groupId },
        });
        return (await dbOrder(m1.order_id)).payment_collections[0].id;
      };

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("AC-39: returns the caller's draft order with items, payment collection and group deadline", async () => {
        const collectionId = await succeed();
        const res = await get(one(m1.order_id));
        expect(res.status).toEqual(200);
        expect(res.headers["cache-control"]).toContain("no-store");
        expect(res.headers["cache-control"]).toContain("private");
        expect(res.data.membership).toEqual(
          expect.objectContaining({
            id: m1.id,
            status: "awaiting_payment",
            units: 1,
          }),
        );
        expect(res.data.group).toEqual(
          expect.objectContaining({ id: groupId, status: "succeeded" }),
        );
        expect(res.data.group.pay_deadline_at).toBeTruthy();

        const order = res.data.order;
        expect(order).toEqual(
          expect.objectContaining({
            id: m1.order_id,
            is_draft_order: true,
            currency_code: "thb",
          }),
        );
        for (const key of [
          "display_id",
          "status",
          "total",
          "subtotal",
          "discount_total",
          "tax_total",
          "payment_status",
        ]) {
          expect(order).toHaveProperty(key);
        }
        expect(order.items).toHaveLength(1);
        expect(order.items[0]).toEqual(
          expect.objectContaining({
            quantity: 1,
            title: expect.any(String),
            unit_price: expect.anything(),
          }),
        );
        for (const key of ["id", "variant_title", "thumbnail", "total"]) {
          expect(order.items[0]).toHaveProperty(key);
        }

        const db = await dbOrder(m1.order_id);
        expect(MathBN.eq(order.total, plain(db.total))).toBe(true);
        expect(order.payment_collections).toHaveLength(1);
        expect(order.payment_collections[0].id).toEqual(collectionId);
        expect(
          MathBN.eq(
            order.payment_collections[0].amount,
            plain(db.payment_collections[0].amount),
          ),
        ).toBe(true);
        expect(order.payment_collections[0].payment_sessions).toEqual([]);
      });

      it("AC-39: another customer's order, unknown order and a non group-buy order → 404 not_found", async () => {
        await succeed();
        const normal = await getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            customer_id: aId,
            email: "gb8-a@example.com",
            currency_code: "thb",
          });

        for (const [path, headers] of [
          [one(m1.order_id), b],
          [one(m3.order_id), a],
          [one("order_missing_gb8"), a],
          [one(normal.id), a],
        ] as const) {
          const res = await get(path, headers);
          expect(res.status).toEqual(404);
          expect(res.data.type).toEqual("not_found");
        }
      });

      it("AC-39: no token → 401", async () => {
        const res = await get(one(m1.order_id), storeHeadersFor(pk));
        expect(res.status).toEqual(401);
      });

      it("AC-39: payment session data exposes only id, client_secret, status", async () => {
        jest
          .spyOn(Stripe.StripeResource.prototype, "_makeRequest")
          .mockImplementation(() => {
            throw new Error("unexpected network call to Stripe in test");
          });
        jest
          .spyOn(Stripe.resources.Customers.prototype, "create")
          .mockImplementation(async () => ({
            id: "cus_gb8_test",
            object: "customer",
          }));
        jest
          .spyOn(Stripe.resources.PaymentIntents.prototype, "create")
          .mockImplementation(async (params: any) => ({
            id: "pi_gb8_1",
            object: "payment_intent",
            client_secret: "pi_gb8_1_secret_x",
            status: "requires_payment_method",
            amount: params.amount,
            currency: "thb",
            customer: "cus_gb8_test",
            metadata: params.metadata,
          }));
        const collectionId = await succeed();

        const created = await settle(
          api.post(
            `/store/payment-collections/${collectionId}/payment-sessions`,
            { provider_id: "pp_stripe_stripe" },
            a,
          ),
        );
        expect(created.status).toEqual(200);
        const sessionId =
          created.data.payment_collection.payment_sessions[0].id;

        const res = await get(one(m1.order_id));
        expect(res.status).toEqual(200);
        const sessions = res.data.order.payment_collections[0].payment_sessions;
        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toEqual(
          expect.objectContaining({
            id: sessionId,
            provider_id: "pp_stripe_stripe",
            status: expect.any(String),
          }),
        );
        expect(sessions[0]).toHaveProperty("amount");
        expect(sessions[0].data).toEqual({
          id: "pi_gb8_1",
          client_secret: "pi_gb8_1_secret_x",
          status: "requires_payment_method",
        });
      });

      it("AC-40: still readable after the draft order is converted to a regular order", async () => {
        await succeed();
        await convertDraftOrderWorkflow(getContainer()).run({
          input: { id: m1.order_id },
        });
        const res = await get(one(m1.order_id));
        expect(res.status).toEqual(200);
        expect(res.data.order.is_draft_order).toBe(false);

        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "group_buy_membership",
            fields: ["status"],
            filters: { id: m1.id },
          });
        expect(res.data.membership.status).toEqual(data[0].status);
      });
    });

    // AC-39: migration ของ GB-8 (test runner รัน migration จริง)
    it("AC-39: migration adds a (customer_id, joined_at) index on group_buy_membership", async () => {
      const pg = getContainer().resolve(
        ContainerRegistrationKeys.PG_CONNECTION,
      );
      const { rows } = await pg.raw(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'group_buy_membership'`,
      );
      expect(
        rows.some((r: { indexdef: string }) =>
          /\(customer_id, joined_at\) WHERE \(deleted_at IS NULL\)/.test(
            r.indexdef,
          ),
        ),
      ).toBe(true);
    });
  },
});
