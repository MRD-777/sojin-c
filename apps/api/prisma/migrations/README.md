# Database Migrations

## ⚠️ Critical Rules

1. **NEVER** run `prisma db push` against production. Use `prisma migrate deploy`.
2. **NEVER** edit a migration that's already been applied to production. Create a new one.
3. **NEVER** delete a migration folder. If you need to revert, write a forward migration that undoes it.
4. **ALWAYS** backup before applying a migration on production.
5. **ALWAYS** test migrations on staging first.

---

## Workflow

### First-time baseline (existing Supabase DB)

The DB was created with `prisma db push` originally. To start using migrations on the existing DB:

```bash
# 1. Generate baseline SQL from current schema (no DB write)
pnpm --filter api prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2. Mark as already applied (DB already has these tables)
pnpm --filter api prisma migrate resolve --applied 0_init

# 3. Verify
pnpm --filter api prisma migrate status
```

After baseline, all new schema changes go through `migrate dev` (local) / `migrate deploy` (prod).

### Local development (creating a new migration)

```bash
# 1. Edit schema.prisma
# 2. Generate migration + apply locally
pnpm --filter api prisma migrate dev --name <descriptive_name>

# 3. Review the generated SQL in prisma/migrations/<timestamp>_<name>/migration.sql
# 4. Commit both the schema.prisma and the migration folder
```

### Staging / Production deploy

```bash
# Apply all pending migrations
pnpm --filter api prisma migrate deploy

# Verify
pnpm --filter api prisma migrate status
```

---

## Naming Convention

- Migration name describes the **change**, not the feature: `add_payment_deleted_by`, not `payments_feature`
- Use snake_case
- Keep names < 50 chars

---

## Existing Migrations

| Order | Name | Purpose |
|---|---|---|
| 1 | `0_init` (to be generated via baseline) | Initial schema (18 models from `db push`) |
| 2 | `20260512000000_audit_immutability` | DB-level trigger preventing UPDATE/DELETE/TRUNCATE on `audit_logs` |
| 3 | `20260512000001_soft_delete_payments_media` | Add `deletedBy` + `deletionReason` to `payments`; add `deletedAt` + `deletedBy` + `deletionReason` to `media` |

---

## Rollback Strategy

Prisma does **not** auto-generate rollback scripts. For each migration:

1. Write a forward migration that undoes the change (e.g., `20260513000000_revert_X`)
2. Test the rollback on staging first
3. Coordinate with Supabase PITR backup as the ultimate safety net

For schema changes that would destroy data (e.g., dropping a column), use a multi-step approach:
- Step 1: Add the new structure (additive)
- Step 2: Migrate data
- Step 3: Switch the app to use the new structure
- Step 4: Drop the old structure (after monitoring period)
