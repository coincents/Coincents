---
title: "Evolving a Prisma Schema Without Losing Production Data"
date: "2025-11-19"
tags: ["prisma", "postgres", "neon", "migrations", "devops"]
summary: "How we added SIWE-ready fields, deposits, and admin roles to a live Neon database without downtime."
---

import Callout from "@/components/Callout"

## The Setup

We inherited a crypto trading simulator whose production database (Neon) already had tables created manually:

- `users`, `trades`, `transactions`, `withdraw_requests`

But the codebase had moved far ahead:

- Admin roles (`role`, `username`, `displayUsername`, ban flags)
- Trade snapshots (`direction`, `priceOpen`, `priceOpenAt`, etc.)
- `deposits`, `audit_logs`
- Withdrawal metadata (`toAddress`, `adminNotes`)

When we ran `npx prisma migrate deploy` against Neon we immediately hit:

```
ERROR: relation "users" already exists
```

Prisma’s first migration was trying to create tables that already existed. Welcome to schema drift.

---

## Step 1 – Mark Legacy Migrations as Applied

<Callout type="info">
If Prisma’s `_prisma_migrations` table doesn’t list the migrations that built your current schema, you can tell Prisma “pretend this migration already ran” using `prisma migrate resolve`.
</Callout>

We told Prisma to skip the two legacy migrations that had already been applied manually:

```bash
DATABASE_URL="postgres://<prod>" \
npx prisma migrate resolve --applied 20250902181313_init

DATABASE_URL="postgres://<prod>" \
npx prisma migrate resolve --applied 20250910205257_add_transactions
```

After that Prisma moved on to the new migrations.

---

## Step 2 – Rewrite the Risky Migration

Our first draft migration added NOT NULL columns and unique constraints immediately:

- `trades.direction`, `trades.priceOpen`, `trades.priceOpenAt`
- `withdraw_requests.toAddress`
- unique `users.username` / `users.displayUsername`

That would explode on a non-empty table, so we rewrote it to:

1. **Add columns as nullable**
2. **Backfill with safe defaults**
3. **Set defaults + enforce NOT NULL**
4. **Populate usernames before creating unique indexes**

```sql
ALTER TABLE "trades"
  ADD COLUMN "direction" TEXT,
  ADD COLUMN "priceOpen" DOUBLE PRECISION,
  ADD COLUMN "priceOpenAt" TIMESTAMP(3);

UPDATE "trades"
SET
  "direction"   = COALESCE("direction", 'UP'),
  "priceOpen"   = COALESCE("priceOpen", 0),
  "priceOpenAt" = COALESCE("priceOpenAt", NOW());

ALTER TABLE "trades"
  ALTER COLUMN "direction" SET DEFAULT 'UP',
  ALTER COLUMN "direction" SET NOT NULL,
  ...
```

Same pattern for `withdraw_requests.toAddress` and user names.

---

## Step 3 – Validate Locally

1. Created a local Postgres DB: `createdb coincents_dev`
2. Pointed `DATABASE_URL` to it.
3. Ran `npx prisma migrate reset` to apply all migrations from scratch.
4. Seeded a test admin via `npx prisma db seed`.

Everything ran cleanly, so we knew the SQL was trustworthy.

---

## Step 4 – Deploy to Neon Safely

With the legacy migrations resolved, we ran:

```bash
DATABASE_URL="postgres://<prod>" npx prisma migrate deploy
```

Output:

```
Applying migration `20251119194448_add_admin`
All migrations have been successfully applied.
```

No downtime, no data loss. Neon now has:

- `users.role`, `username`, `displayUsername`, ban fields
- `trades.direction/priceOpen/priceOpenAt` with defaults
- `withdraw_requests.toAddress`, `adminNotes`
- New `deposits` and `audit_logs` tables
- `_prisma_migrations` table in sync with the actual schema

---

## Step 5 – Seed the First Admin

Because we rely on Better Auth for email/username sign-in, we needed an admin user that exists in both Prisma and Better Auth’s password flow. Our seed script now:

1. Calls `POST /api/auth/sign-up/email` (server must be running).
2. Updates the user via Prisma to set `role = 'ADMIN'` and optional wallet.

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=change-me \
npm run prisma:seed
```

After the first admin logs in, additional admins are created via the Admin UI.

---

## Lessons Learned

- **Resolve drift before deploying**  
  Use `prisma migrate resolve --applied <name>` to align history with reality.

- **Stage migrations**  
  Add nullable columns, backfill, then enforce NOT NULL/UNIQUE. Never drop a NOT NULL column into a table with existing rows.

- **Test locally**  
  `npx prisma migrate reset` against a disposable DB is worth the time.

- **Document the workflow**  
  Having a repeatable “mark legacy migrations → deploy → seed” checklist saved us from accidental downtime.

---

If you face a similar situation, steal this playbook. Prisma’s tooling is powerful, but only if you respect the migration history and take staging seriously. Happy migrating!
```