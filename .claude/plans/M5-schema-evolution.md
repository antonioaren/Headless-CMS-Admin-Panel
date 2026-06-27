# M5 — Schema evolution ⭐ (Feature D) — THE HEADLINE

**Goal:** For any schema mutation: communicate risk → surface affected entries → preview before applying → repair data that no longer fits. One pipeline, five mutation types. (→ REQ-D)

> Graded hardest. A working slice beats a broad broken one. Protect this milestone's scope.

## Acceptance (REQ-D.1–D.4)
- One pipeline: `diff(current, proposed) → changes[] → scan entries → classify each cell ok|auto|manual → MigrationPlan`.
- `POST /api/schemas/:id/plan` = dry run, returns `MigrationPlan`, writes nothing.
- `POST /api/schemas/:id/apply` = single transaction: bump version, write auto values, flag manual cells.
- Rename = pure label edit, zero entry migration.
- Delete field = destructive warning + drop/archive key into `config`.
- Retype coercion (REQ-D.3): text→number (`"2024"`→auto, `"vintage"`/`"n/a"`→manual), number→text auto, any→boolean / any→date by parse, make-required empty→manual, retarget non-empty→manual.
- UI: render plan summary + affected list, `apply` only on explicit confirm. Repair UI surfaces `manual` cells, repairs via `PATCH /api/entries/:id`.

## Approach
- **`packages/shared`**: a pure `diff(current, proposed): MigrationChange[]` and `classifyCell(change, value): { status, proposedValue?, reason? }`. Pure functions → unit-testable, reused by client preview and server apply. `MigrationPlan` type already defined in shared (PRD §5.3).
- **Backend**: `plan` runs diff + classify over all entries (read-only). `apply` re-runs the plan inside a transaction, writes `auto` values into `entries.data`, leaves `manual` untouched but tracked (e.g. a flag in `config`/a side list), bumps `schemas.version`, then emits `schema.updated` (M4 helper).
- **Frontend**: a migration preview modal driven entirely by the returned `MigrationPlan` (summary counts + per-entry impact rows). Confirm → `apply`. Repair view reuses the M2 `EntryForm` for `manual` cells.

## Files (new)
`packages/shared/src/migration.ts` (diff + classify) · `apps/backend/src/routes/migrations.ts` (plan/apply) · `apps/frontend/src/features/migration/` (preview modal + repair view).

## Verify
Retype Car.year text→number: plan shows `"2024"` auto=2024, `"vintage"`/`"n/a"` manual; confirm apply; repair the two manual cells; entry validates. Rename a field: confirm NO entry row changed.

## Watch
- ONE pipeline — do not branch into per-mutation handlers (ADR-004).
- `plan` writes NOTHING. `apply` is the only writer, in one transaction.
- Classification logic lives in shared so client preview and server apply agree exactly.
