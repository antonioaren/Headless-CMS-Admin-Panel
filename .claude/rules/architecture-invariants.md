# Architecture Invariants — DO NOT VIOLATE

These are load-bearing decisions from PRD §3 and `docs/decisions.md` (ADR-001..004). Breaking one breaks Feature D — the graded core. If a change seems to require violating one, STOP and surface it instead of working around it.

## Data model

- **Three fixed tables only**: `schemas`, `fields`, `entries`. No dynamic DDL — never `ALTER TABLE` per content schema. Only `entries.data` (JSONB) is dynamic. (ADR-003)
- **`entries.data` is keyed by `field.id`, NEVER by field name/key.** Shape: `{ "f_abc": "Tesla", "f_owner": "<uuid>" }`. (ADR-001)
  - Renaming a field = a one-row edit of `fields.key`. It MUST NOT touch any entry row.
  - Any read-facing output (read API, forms) resolves `field.id` → current `fields.key` on the way out.
- **References are entry UUIDs stored in JSONB. NO database foreign key on reference values.** Integrity is enforced in app code. (ADR-002)
  - This is deliberate: Feature D must hold temporarily-broken state (a retargeted reference pointing at the wrong schema) to preview and repair it. An FK would forbid that state. Do not "fix" this by adding an FK.
  - The `fields.reference_schema_id` column (which schema a reference field targets) is a normal column and may reference `schemas(id)`; the prohibition is only on FKs over the *values inside `entries.data`*.
- **`schemas.version` bumps on EVERY schema change.** It is the mid-edit collision signal (open forms record `renderedSchemaVersion`).

## Schema evolution (Feature D)

- **One `MigrationPlan` pipeline for all five mutation types** (rename/delete/retype/require/retarget). Do not build per-mutation flows. (ADR-004)
  - Pipeline: `diff(current, proposed) → changes[] → scan entries → classify each affected cell as ok|auto|manual → MigrationPlan`.
  - `POST /api/schemas/:id/plan` is a dry run — returns a `MigrationPlan`, writes NOTHING. This IS the preview.
  - `POST /api/schemas/:id/apply` commits in a single transaction: bump version, write auto-coerced values, leave `manual` cells flagged.
  - UI always calls `plan` first; `apply` only on explicit user confirm.
- The `MigrationPlan` type lives in `packages/shared` and matches PRD §5.3. Do not redefine it per-app.

## Write path (the rule)

`client → REST mutation → DB write (transaction) → on success, socket.io emit → all clients patch their TanStack Query cache.`

- The server emits a socket event **only after** a successful DB write. DB is the source of truth.
- Socket payloads are **thin** — `{ id, schemaId, version }`. Clients use them as a signal to refetch/patch, **never** as the source of truth. Do not put entity bodies in socket payloads.

## Shared contract

- `packages/shared` (`@cms/shared`) is the single source of `Field`, `Schema`, `Entry`, `MigrationPlan`, and `buildZodSchema(fields)`. Both apps import these verbatim — zero drift. Change a contract type in one place only.
