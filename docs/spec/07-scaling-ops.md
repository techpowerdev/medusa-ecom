# 07 Scaling & operations

Status: draft
Goal (owner): handle many users well; production-ready. No over-engineering: everything
here is Medusa's documented production setup plus a few indexes and a load test.

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Split HTTP from background work | `workerMode: "server" | "worker"` | 2 deployables |
| Durable events / jobs | Redis Event Bus, Redis Workflow Engine, Redis Locking, Redis Cache modules | enable in prod |
| Horizontal scaling of API | Stateless server; `--cluster` flag | N replicas |
| DB pooling | `databaseDriverOptions` | set pool size |
| Static assets | File module S3 provider + CDN | S3 + CDN |
| Storefront caching | Next.js ISR/`revalidateTag` + Medusa publishable key | starter default |

## Target (v1.0)
- 2k concurrent storefront users, 50 checkouts/min sustained, flash-sale burst 500
  add-to-cart/s for 60s, p95 API < 300ms, zero oversell of limited counters.

## Deliverables
1. Docker images: `backend` (same image, `MEDUSA_WORKER_MODE` env selects server/worker),
   `storefront`.
2. Compose for local; prod reference: 2× server, 1× worker (scale as needed), Postgres
   (managed), Redis (managed), S3-compatible storage, CDN in front of storefront and files.
3. Redis modules enabled in `medusa-config.ts` for prod: event bus, workflow engine, cache, locking.
4. Indexes: every custom module column used in filters (listed in each spec), plus review
   `EXPLAIN` for the 5 hottest store queries.
5. Rate limiting (reverse proxy or middleware) on `/store/auth/*`, `/store/group-buy/*/join`,
   `/store/affiliate/r/*`.
6. Observability: JSON logs with request id, error tracking (Sentry), `/health` for liveness.
   (Tracing deferred until a measured need.)
7. Backups: daily Postgres snapshots; restore drill documented.
8. Load test: k6 scripts under `tools/load/` for browse, flash-sale burst, group-buy join;
   run in CI nightly against staging; results saved to `docs/evidence/scale/`.

## Acceptance criteria
- AC-1 Backend boots as `server` and `worker` from the same image; scheduled jobs run only on worker.
- AC-2 k6 flash-sale burst: 500 rps for 60s against `total_cap=100` → exactly 100
  discounted orders, p95 < 300ms, 0 5xx.
- AC-3 k6 group-buy join: 200 concurrent joins to a 10-person group → exactly 10 members.
- AC-4 Restore drill from backup completes and store boots (runbook).

## Tasks
| ID | Task | Depends |
|----|------|---------|
| OPS-1 | Dockerfiles + compose + worker mode env + health (AC-1) | CORE-1 |
| OPS-2 | Prod config: Redis modules, pool size, S3, CDN docs | OPS-1 |
| OPS-3 | Logging/Sentry + rate limiting | OPS-1 |
| OPS-4 | k6 scripts + nightly CI job + evidence (AC-2, AC-3) | FS-6, GB-7 |
| OPS-5 | Index review + migrations; backup/restore runbook (AC-4) | all modules |
