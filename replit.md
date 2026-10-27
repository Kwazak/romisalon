# Romi Salon

Romi Salon helps guests discover beauty services, book visits, earn membership benefits, and gives salon staff tools to manage daily operations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`
- Optional env: `MOCK_PAYMENT` (simulations are enabled unless set to `false`), `MIDTRANS_SERVER_KEY` (webhook signature verification only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/romi-salon` — Indonesian React/Vite app and user-facing flows
- `artifacts/api-server/src/routes` — salon, account, booking, payment-notification, and admin APIs
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated client hooks
- `lib/db/src/schema/salon.ts` — PostgreSQL schema for salon data
- `artifacts/romi-salon/public/videos/salon.mp4` and `public/images/hero-poster.jpg` — replaceable landing-page media

## Architecture decisions

- The selected web artifact is React/Vite; backend requests use the existing shared Express API.
- The workspace is provisioned for PostgreSQL and Drizzle, so the salon schema uses that stack rather than adding a separate SQLite/Prisma database.
- Demo payment results, points, spending, and membership updates are server-authoritative. Live Midtrans Snap checkout is not connected.
- Sessions use HTTP-only, signed cookies with `SESSION_SECRET`.

## Product

- Public service catalog, salon location and hours, membership tiers, testimonials, and booking.
- Member registration/login, profile and password changes, bookings, payment simulation, points, level progress, and notifications.
- Admin overview, service and membership management, member controls, booking status management, and transaction filtering/export.

## User preferences

- User specified Bahasa Indonesia, Rupiah, Asia/Jakarta time, and the Romi Salon plum/ivory/gold/blush/sage palette.

## Gotchas

- Push the Drizzle schema before starting the API server on a fresh database. Demo records are seeded by the API at startup.
- `MOCK_PAYMENT=false` disables demo payments; do not set it until live checkout is configured.
- Midtrans webhook signature checks need `MIDTRANS_SERVER_KEY`; this alone does not create Snap checkout sessions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
