## Live Application

https://apparelflow-ngpp586z5-dinushkams-projects.vercel.app

## Repository

https://github.com/dinushkam/-APPARELFLOW-ERP

# ApparelFlow ERP — Production Batch Verification & Sewing Queue Gate

A production-oriented implementation of Webtezza's ApparelFlow ERP practical engineering challenge. The application models the Cutting Operations & Gatekeeper Verification Terminal with server-enforced RBAC, deterministic production states, persistent PostgreSQL storage, immutable verification audit records, a shortage hard stop, and a verified-only Sewing Queue.

## Architecture

- **Frontend / full-stack framework:** Next.js App Router + React
- **Backend:** Next.js Route Handlers (server APIs)
- **Database:** PostgreSQL (works with Supabase, Neon, Railway Postgres, Render Postgres)
- **Authentication:** signed HttpOnly JWT cookie; identity and role are derived server-side
- **Validation:** Zod request validation + domain-level hard-stop checks
- **Tests:** Vitest
- **Deployment target:** Vercel + PostgreSQL provider

## State machine

`CUTTING_IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED -> SEWING`

A verifier may instead transition `PENDING_VERIFICATION -> REJECTED`. The Cutting Supervisor can re-cut and resubmit a rejected batch, which resets component counts and returns it to `PENDING_VERIFICATION` while preserving the prior rejection log.

## Non-bypassable security rules

1. **Server-side RBAC** — every privileged route calls `requireRole(...)`. A supervisor or sewing user cannot approve/reject even by direct cURL/Postman request.
2. **Hard stop** — `/api/orders/:id/approve` reloads all verification items from the database inside a transaction. Any missing/uncounted/RED item produces HTTP `422`.
3. **Sewing query isolation** — `/api/sewing/queue` contains a literal database predicate `WHERE o.status = 'VERIFIED'`; URL manipulation cannot reveal pending or rejected batches.
4. **Authenticated audit attribution** — verifier ID comes from the server session, never from request JSON.
5. **Immutable audit records** — PostgreSQL triggers reject UPDATE and DELETE operations on `verification_logs`.
6. **Concurrency safety** — approval/rejection locks the cutting order with `FOR UPDATE` before state transition.

## Database schema

Core entities:

- `users(id, email, password_hash, role, full_name, created_at)`
- `recipes(id, recipe_code, name, category, std_fabric_yards, wastage_cap)`
- `recipe_components(id, recipe_id, component_name, pieces_per_garment, image_url)`
- `cutting_orders(id, order_no, recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by, timestamps...)`
- `verification_items(id, order_id, component_id, expected_qty, actual_qty, status)`
- `verification_logs(id, order_id, verifier_id, decision, rejection_note, wastage_pct, component_variances, timestamp)`

`component_variances` is an intentional extension so the immutable approval log permanently stores expected/actual differences for every component.

## Pre-seeded recipes

- `REC-BL01` — Casual Blouse — 1.8 yards/garment — 5% wastage cap
- `REC-CT02` — Crop Top — 1.1 yards/garment — 8% wastage cap

The component multiplier is applied when an order is created, e.g. 50 garments × 2 cuffs = 100 expected cuffs.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Cutting Supervisor | `supervisor@apparelflow.demo` | `Supervisor123!` |
| Cutting Verifier | `verifier@apparelflow.demo` | `Verifier123!` |
| Sewing Supervisor | `sewing@apparelflow.demo` | `Sewing123!` |

The visible demo account panel provides seeded credentials for evaluator testing. Once authenticated, the active role is locked to the server-side session. To access another role, the user must sign out and authenticate again using the appropriate account.

## Local setup

1. Create a PostgreSQL database (local, Supabase, Neon, Railway, etc.).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and a 32+ character `JWT_SECRET`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize schema and seed data:
   ```bash
   npm run db:init
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000`.

## Automated tests

```bash
npm test
```

The suite directly covers the five mandatory rules from the assessment plus traffic-light, numeric guard, and wastage formula edge cases.

## 5-minute evaluator flow

1. Sign in as **Cutting Supervisor**, create a Casual Blouse order for 50 garments.
2. Sign in as **Cutting Verifier**, enter exact counts for all items. Approval becomes enabled; approve it.
3. Sign in as **Sewing Supervisor**. The batch is present in the queue and survives refresh.
4. Create a second order, then as Verifier enter at least one count below expected. Approval remains disabled. A direct API approval attempt returns `422`.
5. Try approval while authenticated as Cutting Supervisor. The server returns `403`.
6. Reject a batch with an empty reason. Backend validation rejects it.

## Cloud deployment

Recommended path: **Vercel + Neon/Supabase PostgreSQL**.

1. Push this repository to GitHub with iterative commits.
2. Create a Neon/Supabase database and copy its PostgreSQL connection string.
3. Run `npm run db:init` locally against that cloud `DATABASE_URL` once.
4. Import the repository into Vercel.
5. Add `DATABASE_URL` and `JWT_SECRET` to Vercel Environment Variables.
6. Deploy and verify all three role flows.

Do not put `.env.local` or database credentials in GitHub.

## Suggested atomic commit history

Use your real development sequence rather than one bulk commit, for example:

- `chore: scaffold Next.js app and environment config`
- `feat: add PostgreSQL schema and production recipe seeds`
- `feat: implement demo authentication and server RBAC`
- `feat: build supervisor order creation and multiplier engine`
- `feat: add verifier traffic-light count terminal`
- `security: enforce transactional shortage hard stop`
- `feat: add verified-only sewing queue and audit details`
- `test: cover gatekeeper RBAC and queue isolation rules`
- `docs: add deployment guide and AI optimization report`

## Notes

The browser UI intentionally duplicates some validation for immediate feedback, but client checks are never trusted as security controls. The backend repeats every authorization and gatekeeper rule from database state.
